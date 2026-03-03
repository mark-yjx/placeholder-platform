import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, '.github', 'workflows', 'ci.yml'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for CI workflow contract tests');
}

function readCiWorkflow(): string {
  return fs.readFileSync(
    path.join(resolveRepoRoot(), '.github', 'workflows', 'ci.yml'),
    'utf8'
  );
}

test('CI workflow defines blocking checks for pull requests', () => {
  const workflow = readCiWorkflow();
  assert.match(workflow, /^name: CI/m);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /jobs:\s+checks:/s);
  assert.match(workflow, /- name: Install\s+run: npm install/s);
  assert.match(workflow, /- name: Typecheck\s+run: npm run typecheck/s);
  assert.match(workflow, /- name: Test\s+run: npm run -ws --if-present test/s);
  assert.match(workflow, /- name: Build\s+run: npm run -ws --if-present build/s);
});

test('CI workflow defines optional smoke execution for scheduled and manual runs', () => {
  const workflow = readCiWorkflow();
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /run_smoke:/);
  assert.match(workflow, /schedule:/);
  assert.match(
    workflow,
    /if: \$\{\{ github\.event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.run_smoke\) \}\}/
  );
  assert.match(workflow, /jobs:\s+checks:.*\s+smoke:/s);
  assert.match(workflow, /- name: Run local smoke\s+run: npm run smoke:local/s);
});
