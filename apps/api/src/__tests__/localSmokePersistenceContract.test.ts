import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tools', 'scripts', 'local-smoke.mjs'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for local smoke contract tests');
}

function readSmokeScript(): string {
  const repoRoot = resolveRepoRoot();
  return fs.readFileSync(path.join(repoRoot, 'tools', 'scripts', 'local-smoke.mjs'), 'utf8');
}

test('local smoke talks to live API endpoints for login, problem, favorites, and reviews', () => {
  const script = readSmokeScript();
  assert.match(script, /\/auth\/login/);
  assert.match(script, /\/problems/);
  assert.match(script, /\/favorites\//);
  assert.match(script, /\/reviews\//);
});

test('local smoke verifies persistence after API restart', () => {
  const script = readSmokeScript();
  assert.match(script, /restart api container/);
  assert.match(script, /docker compose -f deploy\/local\/docker-compose\.yml restart api/);
  assert.match(script, /fetch persisted data after restart/);
});

