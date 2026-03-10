import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoRoot } from './support/resolveRepoRoot';

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('README is the clean entry point to the consolidated documentation set', () => {
  const readme = readFromRoot('README.md');

  assert.match(readme, /\[Architecture\]\(\.\/docs\/architecture\.md\)/);
  assert.match(readme, /\[Judge Pipeline\]\(\.\/docs\/judge-pipeline\.md\)/);
  assert.match(readme, /\[Problem Format\]\(\.\/docs\/problem-format\.md\)/);
  assert.match(readme, /\[Admin Web\]\(\.\/docs\/admin-web\.md\)/);
  assert.match(readme, /\[Extension Usage\]\(\.\/docs\/extension-usage\.md\)/);
  assert.match(readme, /\[Runtime Metrics\]\(\.\/docs\/runtime-metrics\.md\)/);
  assert.match(readme, /\[Local Development\]\(\.\/docs\/local-development\.md\)/);
  assert.match(readme, /\[Roadmap\]\(\.\/docs\/roadmap\.md\)/);
  assert.match(readme, /\[Problem Manifest\]\(\.\/\.specify\/specs\/problem-manifest\.md\)/);
  assert.match(readme, /\[Submission Feedback\]\(\.\/\.specify\/specs\/submission-feedback\.md\)/);
  assert.doesNotMatch(readme, /extension-demo-checklist/);
  assert.doesNotMatch(readme, /release-runbook/);
});

test('local development doc keeps packaging and verification commands aligned with the new docs structure', () => {
  const localDevDoc = readFromRoot('docs', 'local-development.md');

  assert.match(localDevDoc, /npm run extension:package/);
  assert.match(localDevDoc, /code --install-extension dist\/placeholder-extension\.vsix/);
  assert.match(localDevDoc, /npm run typecheck/);
  assert.match(localDevDoc, /npm run test/);
  assert.match(localDevDoc, /npm run build/);
  assert.match(localDevDoc, /npm run smoke:local/);
  assert.match(localDevDoc, /npm run local:down/);
  assert.match(localDevDoc, /npm run local:reset/);
  assert.match(localDevDoc, /http:\/\/localhost:3100/);
  assert.match(localDevDoc, /run `admin-api` locally/i);
  assert.match(localDevDoc, /@placeholder\/admin/);
});
