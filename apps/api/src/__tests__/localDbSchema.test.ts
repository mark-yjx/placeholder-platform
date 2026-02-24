import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'deploy', 'local', 'sql'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for migration contract tests');
}

const repoRoot = resolveRepoRoot();

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

test('phase 3 migration defines problems engagement schema constraints and indexes', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'migrations', '002_problems_engagement.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS problem_versions/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS favorites/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS reviews/i);

  assert.match(sql, /PRIMARY KEY\s*\(\s*user_id\s*,\s*problem_id\s*\)/i);
  assert.match(sql, /CHECK\s*\(\s*sentiment IN \('like', 'dislike'\)\s*\)/i);
  assert.match(sql, /UNIQUE\s*\(\s*problem_id\s*,\s*version_number\s*\)/i);

  assert.match(sql, /CREATE OR REPLACE FUNCTION prevent_problem_version_mutation\(\)/i);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON problem_versions/i);

  assert.match(sql, /idx_problem_versions_problem_id/i);
  assert.match(sql, /idx_favorites_user_id/i);
  assert.match(sql, /idx_favorites_problem_id/i);
  assert.match(sql, /idx_reviews_user_id/i);
  assert.match(sql, /idx_reviews_problem_id/i);
});

test('local db setup scripts apply all migration and seed files in lexical order', () => {
  const migrateScript = readFromRoot('tools', 'scripts', 'local-db-migrate.mjs');
  const seedScript = readFromRoot('tools', 'scripts', 'local-db-seed.mjs');

  assert.match(migrateScript, /readdirSync\(migrationsDir\)/);
  assert.match(migrateScript, /\.sort\(/);
  assert.match(seedScript, /readdirSync\(seedsDir\)/);
  assert.match(seedScript, /\.sort\(/);
});
