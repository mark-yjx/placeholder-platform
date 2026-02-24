#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const composeFile = path.join(root, 'deploy', 'local', 'docker-compose.yml');
const seedsDir = path.join(root, 'deploy', 'local', 'sql', 'seeds');

const seedFiles = fs
  .readdirSync(seedsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

if (seedFiles.length === 0) {
  throw new Error(`No seed files found in ${seedsDir}`);
}

for (const fileName of seedFiles) {
  const seedFile = path.join(seedsDir, fileName);
  const sql = fs.readFileSync(seedFile, 'utf8');

  execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', 'oj', '-d', 'oj', '-v', 'ON_ERROR_STOP=1'],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit']
    }
  );

  console.log('Seed applied:', seedFile);
}
