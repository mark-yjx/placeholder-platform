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

test('problem detail panel is opened in the editor area from extension runtime', () => {
  const extensionSource = readFromPackageRoot('src', 'extension.ts');

  assert.match(extensionSource, /new ProblemDetailWebviewPanel/);
  assert.match(extensionSource, /createWebviewPanel\(\s*'ojProblemDetailPanel'/);
  assert.match(extensionSource, /vscode\.ViewColumn\.Beside/);
  assert.doesNotMatch(extensionSource, /registerWebviewViewProvider\(\s*'ojProblemDetail'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.openProblemStarter'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.runPublicTests'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.submitCurrentFile'/);
  assert.match(extensionSource, /executeCommand\('oj\.practice\.fetchProblems'/);
});

test('problem detail panel includes required fields and actions', () => {
  const providerSource = readFromPackageRoot('src', 'ui', 'ProblemDetailWebviewProvider.ts');
  const viewModelSource = readFromPackageRoot('src', 'ui', 'ProblemDetailViewModel.ts');

  assert.match(providerSource, /createProblemDetailViewModel\(/);
  assert.match(providerSource, /showProblemDetail\(problem: ProblemDetail \| null\): void/);
  assert.match(providerSource, /this\.currentProblem = problem;/);
  assert.match(providerSource, /if \(!this\.currentPanel\)/);
  assert.match(providerSource, /const panel = this\.createPanel\(\);/);
  assert.match(providerSource, /this\.currentPanel = panel;/);
  assert.match(providerSource, /panel\.webview\.onDidReceiveMessage/);
  assert.match(providerSource, /this\.currentPanel\.reveal\(\);/);
  assert.match(providerSource, /this\.currentPanel\.title = this\.currentProblem\?\.title\?\.trim\(\) \|\| 'Problem Detail';/);
  assert.match(providerSource, /this\.render\(\);/);
  assert.match(viewModelSource, /<h2>\$\{title\}<\/h2>/);
  assert.match(viewModelSource, /Select a problem from the Problems list to view details\./);
  assert.match(viewModelSource, /emptyStateMessage: string/);
  assert.match(viewModelSource, /No statement available\./);
  assert.match(viewModelSource, /Problem ID:/);
  assert.match(viewModelSource, /Starter File:/);
  assert.match(viewModelSource, /summary: string/);
  assert.match(viewModelSource, /extractProblemSummary/);
  assert.match(viewModelSource, /stripLeadingPresentationHeadings/);
  assert.doesNotMatch(viewModelSource, /Entry Function:/);
  assert.doesNotMatch(viewModelSource, /Language:/);
  assert.match(viewModelSource, /entryFunction: string/);
  assert.match(viewModelSource, /problem\.entryFunction\?\.trim\(\) \|\| 'Unknown'/);
  assert.match(viewModelSource, /problem\.title\?\.trim\(\) \|\| 'Untitled problem'/);
  assert.match(viewModelSource, /problem\.language\?\.trim\(\) \?\? null/);
  assert.match(viewModelSource, /path\.basename\(starterFilePath\)/);
  assert.match(viewModelSource, /resolveProblemStatementMarkdown\(problem\) \?\? 'No statement available\.'/);
  assert.match(viewModelSource, /<vscode-button/);
  assert.match(viewModelSource, /Open Coding File/);
  assert.match(viewModelSource, /Run Public Tests/);
  assert.match(viewModelSource, /data-command="submitCurrentFile"/);
  assert.match(viewModelSource, />Submit</);
  assert.match(viewModelSource, /appearance="primary"\$\{submitAttributes\}/);
  assert.match(viewModelSource, /action-cluster/);
  assert.match(viewModelSource, /format-panel/);
  assert.match(viewModelSource, /input\.isEmpty\s*\?\s*''/);
  assert.doesNotMatch(viewModelSource, /refreshProblem/);
  assert.match(viewModelSource, /postMessage\(\{ command: button\.dataset\.command \}\)/);
});
