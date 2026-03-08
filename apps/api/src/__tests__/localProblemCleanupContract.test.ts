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
  throw new Error('Unable to resolve repository root for local problem cleanup contract tests');
}

const repoRoot = resolveRepoRoot();

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

test('local seed data keeps collapse as the only persisted problem', () => {
  const baseSeed = readFromRoot('deploy', 'local', 'sql', 'seeds', '001_mvp_seed.sql');
  const engagementSeed = readFromRoot(
    'deploy',
    'local',
    'sql',
    'seeds',
    '002_problems_engagement_seed.sql'
  );

  assert.match(baseSeed, /INSERT INTO problems \(id, title, publication_state\)/i);
  assert.match(baseSeed, /'collapse', 'Collapse Identical Digits', 'published'/i);
  assert.match(baseSeed, /'collapse-v1'/i);
  assert.match(baseSeed, /entry_function/i);
  assert.match(baseSeed, /problem_version_tests/i);
  assert.doesNotMatch(baseSeed, /'problem-1'/i);
  assert.doesNotMatch(baseSeed, /'problem-2'/i);

  assert.match(engagementSeed, /'student-1', 'collapse'/i);
  assert.doesNotMatch(engagementSeed, /'problem-1'/i);
  assert.doesNotMatch(engagementSeed, /'problem-2'/i);
});

test('local cleanup script removes every non-collapse problem and dependent rows', () => {
  const script = readFromRoot('tools', 'scripts', 'local-problems-cleanup.mjs');
  const packageJson = readFromRoot('package.json');

  assert.match(packageJson, /"local:problems:cleanup": "node tools\/scripts\/local-problems-cleanup\.mjs"/);
  assert.match(script, /SELECT COUNT\(\*\) FROM problems WHERE id = 'collapse'/);
  assert.match(script, /DELETE FROM judge_jobs\s+WHERE problem_id <> 'collapse'/);
  assert.match(script, /DELETE FROM submissions\s+WHERE problem_id <> 'collapse'/);
  assert.match(script, /DELETE FROM reviews\s+WHERE problem_id <> 'collapse'/);
  assert.match(script, /DELETE FROM favorites\s+WHERE problem_id <> 'collapse'/);
  assert.match(script, /ALTER TABLE problem_versions DISABLE TRIGGER trg_problem_versions_immutable/);
  assert.match(script, /DELETE FROM problem_versions\s+WHERE problem_id <> 'collapse'/);
  assert.match(script, /ALTER TABLE problem_versions ENABLE TRIGGER trg_problem_versions_immutable/);
  assert.match(script, /DELETE FROM problems\s+WHERE id <> 'collapse'/);
});

test('local verify script checks real fetchProblems output and stale reference counts', () => {
  const script = readFromRoot('tools', 'scripts', 'local-problems-verify.mjs');
  const packageJson = readFromRoot('package.json');

  assert.match(packageJson, /"local:problems:verify": "node tools\/scripts\/local-problems-verify\.mjs"/);
  assert.match(script, /email: 'student1@example\.com'/);
  assert.match(script, /password: 'secret'/);
  assert.match(script, /requestJson\('\/problems'/);
  assert.match(script, /problems\.length !== 1 \|\| problems\[0\]\?\.problemId !== 'collapse'/);
  assert.match(script, /favorites/i);
  assert.match(script, /submissions/i);
  assert.match(script, /reviews/i);
  assert.match(script, /problem_versions/i);
  assert.match(script, /judge_results/i);
});
