#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'packages/config/dependency-boundaries.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const IMPORT_RE = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]*?\s+from\s+|import\s*\()(?:['"])([^'"`]+)(?:['"]\)?)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function ruleFor(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  if (rel.startsWith('apps/')) return config.rules.apps;
  if (rel.startsWith('packages/domain/')) return config.rules['packages/domain'];
  return null;
}

const files = [...walk(path.join(root, 'apps')), ...walk(path.join(root, 'packages'))];
const errors = [];

for (const filePath of files) {
  const rule = ruleFor(filePath);
  if (!rule) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1];
    if (!specifier.startsWith('@apps/') && !specifier.startsWith('@packages/')) continue;

    const isAllowed = rule.allowWorkspaceImports.includes(specifier);
    if (!isAllowed) {
      const rel = path.relative(root, filePath).replace(/\\/g, '/');
      errors.push(`${rel}: disallowed workspace import \"${specifier}\"`);
    }
  }
}

if (errors.length > 0) {
  console.error('Boundary check failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('Boundary check passed.');
