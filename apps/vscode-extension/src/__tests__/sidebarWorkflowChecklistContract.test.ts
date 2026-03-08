import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readFromRepoRoot(...segments: string[]): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    const target = path.join(candidate, ...segments);
    if (fs.existsSync(target)) {
      return fs.readFileSync(target, 'utf8');
    }
  }
  throw new Error(`Unable to resolve file: ${segments.join('/')}`);
}

test('sidebar account view exposes login and fetch problems actions', () => {
  const source = readFromRepoRoot('apps', 'vscode-extension', 'src', 'ui', 'PracticeTreeViews.ts');

  assert.match(source, /command:\s*'oj\.login'/);
  assert.match(source, /command:\s*'oj\.practice\.fetchProblems'/);
});

test('sidebar-first workflow checklist documents the full no-command-palette flow', () => {
  const checklist = readFromRepoRoot('docs', 'sidebar-workflow-checklist.md');

  assert.match(checklist, /without using the command palette/i);
  assert.match(checklist, /click `Login`/i);
  assert.match(checklist, /click `Fetch Problems`/i);
  assert.match(checklist, /click `Open`/i);
  assert.match(checklist, /click `Submit Current File`/i);
  assert.match(checklist, /`queued` -> `running` -> `finished\|failed`/);
  assert.match(checklist, /entryFunction/i);
  assert.match(checklist, /defines the configured entry function/i);
});
