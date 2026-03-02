import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
