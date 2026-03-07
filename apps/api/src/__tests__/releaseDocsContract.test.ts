import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'docs', 'release-runbook.md'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for release docs contract tests');
}

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('README and demo checklist are linked for release rehearsal', () => {
  const readme = readFromRoot('README.md');
  const checklist = readFromRoot('docs', 'extension-demo-checklist.md');

  assert.match(readme, /\[OJ VSCode Demo Checklist\]\(\.\/docs\/extension-demo-checklist\.md\)/);
  assert.match(readme, /\[Release Runbook\]\(\.\/docs\/release-runbook\.md\)/);
  assert.match(readme, /Release troubleshooting checks/i);

  assert.match(checklist, /One-Command Demo/);
  assert.match(checklist, /Install `apps\/vscode-extension\/oj-vscode-extension-0\.1\.0\.vsix`/i);
  assert.match(checklist, /oj\.apiBaseUrl/);
});

test('release runbook keeps packaging, versioning, and troubleshooting checks aligned with local runtime', () => {
  const runbook = readFromRoot('docs', 'release-runbook.md');

  assert.match(runbook, /Update the extension version in:/);
  assert.match(runbook, /apps\/vscode-extension\/package\.json/);
  assert.match(runbook, /npm run extension:package/);
  assert.match(runbook, /oj-vscode-extension-<version>\.vsix/);
  assert.match(runbook, /dist\/oj-vscode\.vsix/);
  assert.match(runbook, /\[OJ VSCode Demo Checklist\]\(\.\/extension-demo-checklist\.md\)/);
  assert.match(runbook, /Create Release Notes/);
  assert.match(runbook, /Semantic Versioning/);

  assert.match(runbook, /Troubleshooting Checks \(Release Rehearsal\)/);
  assert.match(runbook, /Login failures/);
  assert.match(runbook, /API unavailable/);
  assert.match(runbook, /Missing worker progress/);
  assert.match(runbook, /Duplicate worker symptoms/);
  assert.match(runbook, /curl -sS -X POST http:\/\/localhost:3100\/auth\/login/);
  assert.match(runbook, /curl http:\/\/localhost:3100\/healthz/);
  assert.match(runbook, /curl http:\/\/localhost:3100\/readyz/);
  assert.match(runbook, /logs worker --tail 200/);
  assert.match(runbook, /ps --services --status running/);
  assert.match(runbook, /no second host-side `npm run worker:start` process is used/i);
});
