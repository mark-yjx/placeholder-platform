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

test('phase problem import migration defines immutable per-version canonical assets', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'migrations', '005_problem_import_assets.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS problem_version_assets/i);
  assert.match(sql, /problem_version_id TEXT PRIMARY KEY REFERENCES problem_versions/i);
  assert.match(sql, /entry_function TEXT NOT NULL/i);
  assert.match(sql, /language TEXT NOT NULL CHECK \(language = 'python'\)/i);
  assert.match(sql, /visibility TEXT NOT NULL CHECK \(visibility IN \('public', 'private'\)\)/i);
  assert.match(sql, /starter_code TEXT NOT NULL/i);
  assert.match(sql, /content_digest TEXT NOT NULL/i);
});

test('phase hidden test migration defines public and hidden problem test storage', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'migrations', '006_problem_version_tests.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS problem_version_tests/i);
  assert.match(sql, /problem_version_id TEXT NOT NULL REFERENCES problem_versions/i);
  assert.match(sql, /test_type TEXT NOT NULL CHECK \(test_type IN \('public', 'hidden'\)\)/i);
  assert.match(sql, /input JSONB NOT NULL/i);
  assert.match(sql, /expected JSONB NOT NULL/i);
  assert.match(sql, /UNIQUE \(problem_version_id, test_type, position\)/i);
});

test('phase manifest metadata migration defines optional manifest fields on problem assets', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'migrations', '009_problem_manifest_metadata.sql');
  const seed = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');

  assert.match(sql, /ALTER TABLE problem_version_assets/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS difficulty TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS tags JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS manifest_version TEXT/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS author TEXT/i);
  assert.match(sql, /CHECK \(tags IS NULL OR jsonb_typeof\(tags\) = 'array'\)/i);

  assert.match(seed, /difficulty,/i);
  assert.match(seed, /tags,/i);
  assert.match(seed, /manifest_version,/i);
  assert.match(seed, /author,/i);
});

test('phase manifest examples migration defines optional examples array on problem assets', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'migrations', '010_problem_manifest_examples.sql');
  const seed = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');

  assert.match(sql, /ALTER TABLE problem_version_assets/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS examples JSONB/i);
  assert.match(sql, /CHECK \(examples IS NULL OR jsonb_typeof\(examples\) = 'array'\)/i);
  assert.match(seed, /examples,/i);
});

test('auth password migration stores password hashes for local login verification', () => {
  const migration = readFromRoot('deploy', 'local', 'sql', 'migrations', '008_auth_passwords.sql');
  const seed = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');

  assert.match(migration, /ALTER TABLE users\s+ADD COLUMN IF NOT EXISTS password_hash TEXT/i);
  assert.match(migration, /ALTER TABLE users\s+ALTER COLUMN password_hash SET NOT NULL/i);
  assert.match(seed, /INSERT INTO users \(\s*id,\s*email,\s*(display_name,\s*)?role,\s*(status,\s*)?password_hash,/i);
  assert.match(seed, /password_hash = EXCLUDED\.password_hash/i);
});

test('user management migration defines platform user profile and status fields', () => {
  const migration = readFromRoot('deploy', 'local', 'sql', 'migrations', '011_user_management.sql');
  const seed = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');

  assert.match(migration, /ALTER TABLE users\s+ADD COLUMN IF NOT EXISTS display_name TEXT/i);
  assert.match(migration, /ALTER TABLE users\s+ALTER COLUMN display_name SET NOT NULL/i);
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'\s+CHECK \(status IN \('active', 'disabled'\)\)/i
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ/i);

  assert.match(seed, /INSERT INTO users \(\s*id,\s*email,\s*display_name,\s*role,\s*status,\s*password_hash,/i);
  assert.match(seed, /display_name = EXCLUDED\.display_name/i);
  assert.match(seed, /status = EXCLUDED\.status/i);
  assert.match(seed, /last_login_at = EXCLUDED\.last_login_at/i);
});
