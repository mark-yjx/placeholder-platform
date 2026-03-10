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

test('sidebar no longer registers account login as primary UI', () => {
  const extensionSource = readFromRepoRoot('apps', 'vscode-extension', 'src', 'extension.ts');
  const manifestSource = readFromRepoRoot('apps', 'vscode-extension', 'package.json');

  assert.doesNotMatch(extensionSource, /registerWebviewViewProvider\(\s*'ojAccount'/);
  assert.doesNotMatch(manifestSource, /"id": "ojAccount"/);
  assert.match(extensionSource, /registerWebviewViewProvider\(\s*'ojPracticeHome'/);
  assert.match(manifestSource, /"id": "ojPracticeHome"/);
});

test('status bar account entry and browser auth commands remain available', () => {
  const extensionSource = readFromRepoRoot('apps', 'vscode-extension', 'src', 'extension.ts');
  const statusBarSource = readFromRepoRoot(
    'apps',
    'vscode-extension',
    'src',
    'ui',
    'AccountStatusBarController.ts'
  );
  const panelSource = readFromRepoRoot(
    'apps',
    'vscode-extension',
    'src',
    'ui',
    'AccountWebviewPanel.ts'
  );
  const manifestSource = readFromRepoRoot('apps', 'vscode-extension', 'package.json');

  assert.match(statusBarSource, /this\.item\.text = '\$\(account\) Sign in'/);
  assert.match(statusBarSource, /Signed in as \$\{email\}\. Open OJ account/);
  assert.match(statusBarSource, /commandId = 'oj\.account\.show'/);
  assert.match(extensionSource, /new AccountWebviewPanel/);
  assert.match(panelSource, /message\.command === 'signIn'/);
  assert.match(panelSource, /message\.command === 'signUp'/);
  assert.match(panelSource, /message\.command === 'logout'/);
  assert.match(manifestSource, /"command": "oj\.login"/);
  assert.doesNotMatch(manifestSource, /"command": "oj\.signup"/);
});
