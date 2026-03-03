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

test('local smoke talks to live API endpoints for login, problem, submissions, favorites, and reviews', () => {
  const script = readSmokeScript();
  assert.doesNotMatch(script, /spawn\('npm', \['run', 'api:start'\]/);
  assert.match(script, /waitForApiHealthy/);
  assert.match(script, /\/healthz/);
  assert.match(script, /\/auth\/login/);
  assert.match(script, /\/problems/);
  assert.match(script, /\/submissions/);
  assert.match(script, /\/result/);
  assert.match(script, /\/favorites\//);
  assert.match(script, /\/reviews\//);
});

test('local smoke verifies compose worker processing and persistence after API restart', () => {
  const script = readSmokeScript();
  assert.match(script, /submit and wait for compose worker result/);
  assert.match(script, /configureSmokeJudge/);
  assert.match(script, /waitForSubmissionResult/);
  assert.match(script, /assertSingleTerminalResult/);
  assert.match(script, /COUNT\(\*\) FROM judge_results/);
  assert.match(script, /COUNT\(\*\) FROM judge_jobs/);
  assert.match(script, /restart compose api service/);
  assert.match(script, /docker', \['compose', '-f', composeFile, 'restart', 'api']/);
  assert.match(script, /await restartLocalApiProcess\(\)/);
  assert.match(script, /fetch persisted data after restart/);
  assert.match(script, /assertSubmissionResult\(resultAfterRestart, 'finished', 'AC'\)/);
});
