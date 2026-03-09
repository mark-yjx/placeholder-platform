import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tools', 'scripts', 'migrate-legacy-problem-doctest.mjs'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for legacy doctest migration tests');
}

async function loadMigrationModule() {
  const repoRoot = resolveRepoRoot();
  return import(pathToFileURL(path.join(repoRoot, 'tools', 'scripts', 'migrate-legacy-problem-doctest.mjs')).href);
}

test('migration extracts legacy doctest into manifest publicTests and cleans starter.py', async () => {
  const migration = await loadMigrationModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-doctest-migration-'));
  const problemDir = path.join(tempRoot, 'collapse');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'collapse',
      title: 'Collapse Identical Digits',
      language: 'python',
      entryFunction: 'collapse',
      timeLimitMs: 2000,
      memoryLimitKb: 65536,
      visibility: 'public',
      examples: [],
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Collapse\n', 'utf8');
  await writeFile(
    path.join(problemDir, 'starter.py'),
    [
      'def collapse(number):',
      '    """',
      '    Collapse identical digits.',
      '',
      '    >>> collapse(0)',
      '    0',
      '    >>> collapse(111)',
      '    1',
      '    """',
      '    raise NotImplementedError',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'hidden.json'), '[{"input": 999, "output": 9}]\n', 'utf8');

  const report = migration.migrateProblemDirectory(problemDir, { write: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(problemDir, 'manifest.json'), 'utf8')) as {
    publicTests: Array<{ input: number; output: number }>;
  };
  const starter = fs.readFileSync(path.join(problemDir, 'starter.py'), 'utf8');

  assert.equal(report.problemId, 'collapse');
  assert.equal(report.doctestFound, true);
  assert.equal(report.publicTestsExtracted, 2);
  assert.equal(report.starterCleaned, true);
  assert.equal(report.manifestUpdated, true);
  assert.deepEqual(report.manualReview, []);
  assert.deepEqual(manifest.publicTests, [
    { input: 0, output: 0 },
    { input: 111, output: 1 }
  ]);
  assert.match(starter, /Collapse identical digits\./);
  assert.doesNotMatch(starter, /^.*>>>.*$/m);
  assert.equal(fs.existsSync(path.join(problemDir, 'hidden.json')), true);
});

test('migration reports compliant starters without altering them', async () => {
  const migration = await loadMigrationModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-doctest-noop-'));
  const problemDir = path.join(tempRoot, 'collapse');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'collapse',
      title: 'Collapse Identical Digits',
      language: 'python',
      entryFunction: 'collapse',
      timeLimitMs: 2000,
      memoryLimitKb: 65536,
      visibility: 'public',
      examples: [],
      publicTests: [{ input: 0, output: 0 }]
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Collapse\n', 'utf8');
  await writeFile(
    path.join(problemDir, 'starter.py'),
    'def collapse(number):\n    """Collapse identical digits."""\n    raise NotImplementedError\n',
    'utf8'
  );
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  const report = migration.migrateProblemDirectory(problemDir, { write: true });

  assert.equal(report.doctestFound, false);
  assert.equal(report.publicTestsExtracted, 0);
  assert.equal(report.starterCleaned, false);
  assert.equal(report.manifestUpdated, false);
  assert.deepEqual(report.manualReview, []);
});

test('migration flags unsupported doctest shapes for manual review instead of guessing', async () => {
  const migration = await loadMigrationModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-doctest-review-'));
  const problemDir = path.join(tempRoot, 'collapse');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'collapse',
      title: 'Collapse Identical Digits',
      language: 'python',
      entryFunction: 'collapse',
      timeLimitMs: 2000,
      memoryLimitKb: 65536,
      visibility: 'public',
      examples: [],
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Collapse\n', 'utf8');
  await writeFile(
    path.join(problemDir, 'starter.py'),
    [
      'def collapse(number):',
      '    """',
      '    >>> collapse(111)',
      '    1',
      '    1',
      '    """',
      '    raise NotImplementedError',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  const report = migration.migrateProblemDirectory(problemDir, { write: true });
  const starter = fs.readFileSync(path.join(problemDir, 'starter.py'), 'utf8');

  assert.equal(report.doctestFound, true);
  assert.equal(report.publicTestsExtracted, 0);
  assert.match(report.manualReview.join('\n'), /expected exactly one output line/i);
  assert.match(starter, /^.*>>>.*$/m);
});
