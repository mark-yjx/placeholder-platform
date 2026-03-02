#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy/local/docker-compose.yml');

console.warn('Warning: local:reset will stop the local stack and delete local Docker volumes for this project.');
console.warn('This removes Postgres data seeded for local development.');

execFileSync('docker', ['compose', '-f', composeFile, 'down', '-v'], {
  cwd: root,
  stdio: 'inherit'
});

console.log('Local stack reset complete.');
console.log('To start fresh again: npm run local:up && npm run local:db:setup');
