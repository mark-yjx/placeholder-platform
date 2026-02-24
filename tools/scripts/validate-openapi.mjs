#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const specPath = path.join(root, 'contracts/openapi/openapi.yaml');

if (!fs.existsSync(specPath)) {
  console.error('OpenAPI validation failed: missing contracts/openapi/openapi.yaml');
  process.exit(1);
}

const content = fs.readFileSync(specPath, 'utf8');
const requiredPatterns = [
  /^openapi:\s*3\./m,
  /^info:\s*$/m,
  /^\s*title:\s*.+$/m,
  /^\s*version:\s*.+$/m,
  /^paths:\s*(\{\}|$)/m
];

for (const pattern of requiredPatterns) {
  if (!pattern.test(content)) {
    console.error(`OpenAPI validation failed: missing required section matching ${pattern}`);
    process.exit(1);
  }
}

console.log('OpenAPI validation passed.');
