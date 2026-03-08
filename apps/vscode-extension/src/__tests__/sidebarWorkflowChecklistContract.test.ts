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

test('sidebar account panel exposes login, fetch problems, and logout actions', () => {
  const extensionSource = readFromRepoRoot('apps', 'vscode-extension', 'src', 'extension.ts');
  const providerSource = readFromRepoRoot(
    'apps',
    'vscode-extension',
    'src',
    'ui',
    'AccountWebviewProvider.ts'
  );
  const viewModelSource = readFromRepoRoot(
    'apps',
    'vscode-extension',
    'src',
    'ui',
    'AccountViewModel.ts'
  );

  assert.match(extensionSource, /registerWebviewViewProvider\(\s*'ojAccount'/);
  assert.match(providerSource, /message\.command === 'login'/);
  assert.match(providerSource, /message\.command === 'logout'/);
  assert.match(viewModelSource, /type="email"/);
  assert.match(viewModelSource, /type="password"/);
  assert.match(viewModelSource, /data-command="login"/);
  assert.match(viewModelSource, /data-command="fetchProblems"/);
  assert.match(viewModelSource, /data-command="logout"/);
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
