#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target || !['api', 'worker'].includes(target)) {
  console.error('Usage: node tools/scripts/validate-env.mjs <api|worker>');
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const schemaPath = path.join(root, 'packages/config/env.required.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const required = schema[target] ?? [];
const missing = required.filter((name) => {
  const value = process.env[name];
  return value === undefined || value === '';
});

if (missing.length > 0) {
  console.error(`Missing required environment variables for ${target}:`);
  for (const name of missing) console.error(`- ${name}`);
  console.error('See packages/config/env.required.json and docs/environment-and-local-setup.md.');
  process.exit(1);
}

console.log(`Environment validation passed for ${target}.`);
