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

test('submission detail panel is registered in extension runtime', () => {
  const extensionSource = readFromPackageRoot('src', 'extension.ts');

  assert.match(extensionSource, /registerWebviewViewProvider\(\s*'ojSubmissionDetail'/);
  assert.match(extensionSource, /showSubmissionDetail\(submission\)/);
});

test('submission detail panel exposes status and detail fields', () => {
  const providerSource = readFromPackageRoot('src', 'ui', 'SubmissionDetailWebviewProvider.ts');

  assert.match(providerSource, /<strong>Status:<\/strong>/);
  assert.match(providerSource, /<h2>\$\{submissionId\}<\/h2>/);
  assert.match(providerSource, /statusSummary/);
  assert.match(providerSource, /detail/);
});

test('submission polling contract stops at terminal states in extension command flow', () => {
  const coreSource = readFromPackageRoot('src', 'extensionCore.ts');

  assert.match(coreSource, /if \(result\.status === 'finished' \|\| result\.status === 'failed'\)/);
  assert.match(coreSource, /return;/);
});
