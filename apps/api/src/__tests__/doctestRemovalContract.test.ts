import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tools', 'scripts', 'import-problems.mjs'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for doctest removal contract tests');
}

function readFromRoot(...segments: string[]): string {
  return fs.readFileSync(path.join(resolveRepoRoot(), ...segments), 'utf8');
}

test('extension implementation uses manifest public tests and does not reference doctest', () => {
  const publicTestRunner = readFromRoot(
    'apps',
    'vscode-extension',
    'src',
    'practice',
    'PublicTestRunner.ts'
  );
  const payloadExtraction = readFromRoot(
    'apps',
    'vscode-extension',
    'src',
    'submission',
    'SubmissionPayloadExtraction.ts'
  );
  const extensionCore = readFromRoot('apps', 'vscode-extension', 'src', 'extensionCore.ts');

  assert.match(publicTestRunner, /publicTests/);
  assert.doesNotMatch(publicTestRunner, /doctest/);
  assert.doesNotMatch(publicTestRunner, /starter\.py/);

  assert.doesNotMatch(payloadExtraction, /doctest/);
  assert.doesNotMatch(extensionCore, /doctest/);
  assert.match(extensionCore, /runLocalPublicTests\(sourceCode, entryFunction, publicTests\)/);
});

test('worker implementation judges explicit tests without any doctest path', () => {
  const judgeExecution = readFromRoot(
    'apps',
    'judge-worker',
    'src',
    'sandbox',
    'PythonJudgeExecution.ts'
  );
  const submissionExtractor = readFromRoot(
    'apps',
    'judge-worker',
    'src',
    'sandbox',
    'PythonSubmissionExtractor.ts'
  );
  const workerRuntime = readFromRoot('apps', 'judge-worker', 'src', 'workerRuntime.ts');

  assert.match(judgeExecution, /tests: readonly ProblemJudgeTestCase\[]/);
  assert.doesNotMatch(judgeExecution, /doctest/);
  assert.doesNotMatch(submissionExtractor, /doctest/);
  assert.doesNotMatch(workerRuntime, /doctest/);
  assert.match(workerRuntime, /entryFunction: judgeConfig\.entryFunction/);
  assert.match(workerRuntime, /tests: judgeConfig\.tests/);
});

test('import pipeline reads manifest public tests and hidden.json without doctest fallback', () => {
  const importer = readFromRoot('tools', 'scripts', 'import-problems.mjs');

  assert.match(importer, /parseManifestCasesFile\(manifestPath, 'publicTests'/);
  assert.match(importer, /parseJsonCasesFile\(path\.join\(problemDir, 'hidden\.json'/);
  assert.doesNotMatch(importer, /public\.json/);
  assert.doesNotMatch(importer, /doctest/);
});
