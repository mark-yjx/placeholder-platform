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
  throw new Error('Unable to resolve repository root for submission state contract tests');
}

const repoRoot = resolveRepoRoot();

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

test('submission state machine migration sets queued default and guarded transitions', () => {
  const sql = readFromRoot(
    'deploy',
    'local',
    'sql',
    'migrations',
    '003_submission_state_machine.sql'
  );

  assert.match(sql, /ALTER TABLE submissions\s+ALTER COLUMN status SET DEFAULT 'queued'/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS problem_version_id TEXT/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION guard_submission_status_transition\(\)/i);
  assert.match(sql, /OLD\.status = 'queued' AND NEW\.status = 'running'/i);
  assert.match(sql, /OLD\.status = 'running' AND NEW\.status IN \('finished', 'failed'\)/i);
  assert.match(sql, /RAISE EXCEPTION 'Invalid submission status transition: % -> %'/i);
  assert.match(sql, /CREATE TRIGGER submission_status_transition_guard/i);
});

test('submission seed populates problem version ids for persisted records', () => {
  const sql = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');

  assert.match(sql, /INSERT INTO submissions \(id, user_id, problem_id, problem_version_id, language, status, source_code\)/i);
  assert.match(sql, /'collapse-v1'/i);
  assert.doesNotMatch(sql, /'problem-1-v1'/i);
  assert.doesNotMatch(sql, /'problem-2-v1'/i);
});

test('submission failure reason migration adds persisted failure_reason column', () => {
  const sql = readFromRoot(
    'deploy',
    'local',
    'sql',
    'migrations',
    '007_submission_failure_reason.sql'
  );

  assert.match(sql, /ALTER TABLE submissions/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS failure_reason TEXT/i);
});
