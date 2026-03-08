import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readFromPackageRoot(...segments: string[]): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), 'apps', 'vscode-extension')];
  for (const candidate of candidates) {
    const target = path.join(candidate, ...segments);
    if (fs.existsSync(target)) {
      return fs.readFileSync(target, 'utf8');
    }
  }
  throw new Error(`Unable to resolve file: ${segments.join('/')}`);
}

test('problem detail panel is registered in extension runtime', () => {
  const extensionSource = readFromPackageRoot('src', 'extension.ts');

  assert.match(extensionSource, /registerWebviewViewProvider\(\s*'ojProblemDetail'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.openProblemStarter'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.submitCurrentFile'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.fetchProblems'/);
});

test('problem detail panel includes required fields and actions', () => {
  const providerSource = readFromPackageRoot('src', 'ui', 'ProblemDetailWebviewProvider.ts');
  const viewModelSource = readFromPackageRoot('src', 'ui', 'ProblemDetailViewModel.ts');

  assert.match(providerSource, /createProblemDetailViewModel\(/);
  assert.match(viewModelSource, /<h2>\$\{title\}<\/h2>/);
  assert.match(viewModelSource, /Select a problem from the Problems list to view details\./);
  assert.match(viewModelSource, /Warning: Statement content is unavailable for this problem\./);
  assert.match(viewModelSource, /Problem ID:/);
  assert.match(viewModelSource, /Entry Function:/);
  assert.match(viewModelSource, /Problem File:/);
  assert.match(viewModelSource, /problem\.entryFunction\?\.trim\(\) \?\? 'Not available'/);
  assert.match(viewModelSource, /problem\.title\?\.trim\(\) \|\| 'Untitled problem'/);
  assert.match(viewModelSource, /resolveProblemStatementMarkdown\(problem\) \?\? ''/);
  assert.match(viewModelSource, /Open/);
  assert.match(viewModelSource, /data-command="submitCurrentFile"/);
  assert.match(viewModelSource, />Submit</);
  assert.match(viewModelSource, /Refresh/);
  assert.match(viewModelSource, /postMessage\(\{ command: button\.dataset\.command \}\)/);
});
