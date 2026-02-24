#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const composeFile = path.join(root, 'deploy', 'local', 'docker-compose.yml');
const migrationsDir = path.join(root, 'deploy', 'local', 'sql', 'migrations');

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

if (migrationFiles.length === 0) {
  throw new Error(`No migration files found in ${migrationsDir}`);
}

for (const fileName of migrationFiles) {
  const migrationFile = path.join(migrationsDir, fileName);
  const sql = fs.readFileSync(migrationFile, 'utf8');

  execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', 'oj', '-d', 'oj', '-v', 'ON_ERROR_STOP=1'],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit']
    }
  );

  console.log('Migration applied:', migrationFile);
}
