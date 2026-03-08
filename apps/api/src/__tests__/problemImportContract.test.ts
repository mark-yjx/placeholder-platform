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
    if (fs.existsSync(path.join(candidate, 'tools', 'scripts', 'import-problems.mjs'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for problem import tests');
}

async function loadImporterModule() {
  const repoRoot = resolveRepoRoot();
  return import(pathToFileURL(path.join(repoRoot, 'tools', 'scripts', 'import-problems.mjs')).href);
}

test('problem import creates collapse on first import and skips an identical re-run', async () => {
  const repoRoot = resolveRepoRoot();
  const importer = await loadImporterModule();
  const store = importer.createInMemoryProblemImportStore();
  const definitions = importer.readProblemDefinitions(path.join(repoRoot, 'data', 'problems'));
  assert.deepEqual(definitions[0].publicTests, [
    { inputJson: '0', expectedJson: '0' },
    { inputJson: '12321', expectedJson: '12321' },
    { inputJson: '-1111222232222111', expectedJson: '-12321' }
  ]);
  assert.deepEqual(definitions[0].hiddenTests, [
    { inputJson: '1111111111111', expectedJson: '1' },
    { inputJson: '-2222222222', expectedJson: '-2' },
    { inputJson: '1000000000000000000001', expectedJson: '101' },
    { inputJson: '-900111212777394440300', expectedJson: '-9012127394030' }
  ]);

  const firstRun = await importer.importProblemDefinitions(definitions, store);
  assert.deepEqual(firstRun, {
    createdProblems: 1,
    createdVersions: 1,
    skipped: 0
  });
  assert.deepEqual(store.snapshot(), [
    {
      slug: 'collapse',
      versionCount: 1,
      latestDigest: definitions[0].contentDigest
    }
  ]);

  const secondRun = await importer.importProblemDefinitions(definitions, store);
  assert.deepEqual(secondRun, {
    createdProblems: 0,
    createdVersions: 0,
    skipped: 1
  });
  assert.deepEqual(store.snapshot(), [
    {
      slug: 'collapse',
      versionCount: 1,
      latestDigest: definitions[0].contentDigest
    }
  ]);
});

test('problem import appends a new version when collapse content changes', async () => {
  const repoRoot = resolveRepoRoot();
  const importer = await loadImporterModule();
  const store = importer.createInMemoryProblemImportStore();
  const [collapse] = importer.readProblemDefinitions(path.join(repoRoot, 'data', 'problems'));

  await importer.importProblemDefinitions([collapse], store);

  const updated = {
    ...collapse,
    hiddenTests: [...collapse.hiddenTests, { inputJson: '4444', expectedJson: '4' }]
  };
  updated.contentDigest = importer.createContentDigest(updated);

  const result = await importer.importProblemDefinitions([updated], store);
  assert.deepEqual(result, {
    createdProblems: 0,
    createdVersions: 1,
    skipped: 0
  });
  assert.deepEqual(store.snapshot(), [
    {
      slug: 'collapse',
      versionCount: 2,
      latestDigest: updated.contentDigest
    }
  ]);
});

test('problem import rejects a problem directory without manifest.json', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-missing-'));
  const problemDir = path.join(tempRoot, 'missing-manifest');

  await mkdir(problemDir, { recursive: true });
  await writeFile(path.join(problemDir, 'statement.md'), '# Missing Manifest\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'public.json'), '[]\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Missing required manifest file: .*manifest\.json/
  );
});

test('problem import rejects malformed manifest.json', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-malformed-'));
  const problemDir = path.join(tempRoot, 'bad-manifest');

  await mkdir(problemDir, { recursive: true });
  await writeFile(path.join(problemDir, 'manifest.json'), '{"problemId":', 'utf8');
  await writeFile(path.join(problemDir, 'statement.md'), '# Bad Manifest\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'public.json'), '[]\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Invalid manifest JSON at .*manifest\.json/
  );
});

test('problem import rejects missing sibling test files in the manifest layout', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-missing-tests-'));
  const problemDir = path.join(tempRoot, 'missing-tests');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'missing-tests',
      title: 'Missing Tests',
      entryFunction: 'run',
      language: 'python',
      timeLimitMs: 1000,
      memoryLimitKb: 1024,
      visibility: 'public'
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Missing Tests\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'public.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /ENOENT|hidden\.json/
  );
});

test('problem import rejects malformed public.json and hidden.json payloads', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-bad-tests-'));
  const problemDir = path.join(tempRoot, 'bad-tests');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'bad-tests',
      title: 'Bad Tests',
      entryFunction: 'run',
      language: 'python',
      timeLimitMs: 1000,
      memoryLimitKb: 1024,
      visibility: 'public'
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Bad Tests\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'public.json'), '{not-json}\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Expected JSON array|Unexpected token/
  );

  await writeFile(path.join(problemDir, 'public.json'), '[]\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '{not-json}\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Expected JSON array|Unexpected token/
  );
});
