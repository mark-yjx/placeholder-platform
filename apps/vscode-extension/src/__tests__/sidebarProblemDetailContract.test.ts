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
  assert.match(extensionSource, /executeCommand\('oj\.practice\.selectProblem'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.submitCurrentFile'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.fetchProblems'/);
});

test('problem detail panel includes required fields and actions', () => {
  const providerSource = readFromPackageRoot('src', 'ui', 'ProblemDetailWebviewProvider.ts');

  assert.match(providerSource, /<h2>\$\{title\}<\/h2>/);
  assert.match(providerSource, /resolveProblemStatementMarkdown\(problem\)/);
  assert.match(providerSource, /Select a problem from the Problems list to view details\./);
  assert.match(providerSource, /Starter:/);
  assert.match(providerSource, /Open Starter/);
  assert.match(providerSource, /data-command="submitCurrentFile"/);
  assert.match(providerSource, /Submit Current File/);
  assert.match(providerSource, /Refresh/);
  assert.match(providerSource, /postMessage\(\{ command: button\.dataset\.command \}\)/);
});
