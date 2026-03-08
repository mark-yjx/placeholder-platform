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

test('sidebar scaffold keeps problem and submission tree views only', () => {
  const source = readFromPackageRoot('src', 'ui', 'PracticeTreeViews.ts');

  assert.match(source, /registerTreeDataProvider\('ojProblems'/);
  assert.match(source, /registerTreeDataProvider\('ojSubmissions'/);
  assert.doesNotMatch(source, /registerTreeDataProvider\('ojAccount'/);
});
