import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'README.md'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for local runtime docs contract tests');
}

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('root README keeps compose as the supported local API and worker runtime', () => {
  const readme = readFile('README.md');

  assert.match(readme, /npm run local:up/);
  assert.match(readme, /npm run local:db:setup/);
  assert.match(readme, /docker compose -f deploy\/local\/docker-compose\.yml ps/);
  assert.match(readme, /compose `api` service is the real API runtime/);
  assert.match(readme, /compose `worker` service is the only supported judge worker path/);
  assert.match(readme, /do not start an extra host-side `npm run api:start` or `npm run worker:start`/);
  assert.doesNotMatch(readme, /Start the worker runtime:/);
  assert.doesNotMatch(
    readme,
    /DATABASE_URL=.*npm run worker:start/
  );
});

test('environment setup doc keeps compose worker as the single supported worker path', () => {
  const setupDoc = readFile('docs', 'environment-and-local-setup.md');

  assert.match(setupDoc, /compose `api` service on `3100` is the real local API runtime used by the extension/);
  assert.match(setupDoc, /compose `worker` service is the only supported judge worker path for normal local use/);
  assert.match(setupDoc, /Do not start a second host-side `npm run worker:start`\./);
});

test('admin import doc defines the supported local content workflow without manual SQL edits', () => {
  const adminDoc = readFile('docs', 'admin-problem-import-workflow.md');
  const docsIndex = readFile('docs', 'README.md');

  assert.match(docsIndex, /Admin Problem Import And Local Content Workflow/);
  assert.match(adminDoc, /npm run local:up/);
  assert.match(adminDoc, /npm run local:db:setup/);
  assert.match(adminDoc, /npm run import:problems -- --dir problems/);
  assert.match(adminDoc, /problems\/collapse\/manifest\.json/);
  assert.match(adminDoc, /problems\/collapse\/statement\.md/);
  assert.match(adminDoc, /problems\/collapse\/starter\.py/);
  assert.match(adminDoc, /problems\/collapse\/public\.json/);
  assert.match(adminDoc, /problems\/collapse\/hidden\.json/);
  assert.match(adminDoc, /queued -> running -> finished\|failed/);
  assert.match(adminDoc, /manual database edits/i);
  assert.match(adminDoc, /does not require manual database edits/i);
  assert.match(adminDoc, /Minimal Admin API Operability/i);
  assert.match(adminDoc, /POST http:\/\/localhost:3100\/admin\/problems/);
  assert.match(adminDoc, /PUT http:\/\/localhost:3100\/admin\/problems\/admin-demo-1/);
  assert.match(adminDoc, /POST http:\/\/localhost:3100\/admin\/problems\/admin-demo-1\/publish/);
  assert.match(adminDoc, /http:\/\/localhost:3100\/admin\/submissions\/<submissionId>/);
  assert.match(adminDoc, /student token receives `403 FORBIDDEN`/i);
});
