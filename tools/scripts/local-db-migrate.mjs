#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
const composeFile = path.join(root, 'deploy', 'local', 'docker-compose.yml');
const migrationFile = path.join(root, 'deploy', 'local', 'sql', 'migrations', '001_init.sql');

const sql = fs.readFileSync(migrationFile, 'utf8');

execSync(`docker compose -f ${composeFile} exec -T postgres psql -U oj -d oj -v ON_ERROR_STOP=1`, {
  input: sql,
  stdio: ['pipe', 'inherit', 'inherit']
});

console.log('Migration applied:', migrationFile);
