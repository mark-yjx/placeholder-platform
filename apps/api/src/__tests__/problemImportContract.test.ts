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

async function writeManifestProblem(
  rootDir: string,
  {
    problemId = 'manifest-problem',
    title = 'Manifest Problem',
    entryFunction = 'run',
    language = 'python',
    timeLimitMs = 1000,
    memoryLimitKb = 1024,
    visibility = 'public'
  }: {
    problemId?: string;
    title?: string;
    entryFunction?: string;
    language?: string;
    timeLimitMs?: number;
    memoryLimitKb?: number;
    visibility?: string;
  } = {}
) {
  const problemDir = path.join(rootDir, problemId);
  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId,
      title,
      entryFunction,
      language,
      timeLimitMs,
      memoryLimitKb,
      visibility,
      examples: [],
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), `# ${title}\n`, 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), `def ${entryFunction.replace(/[^A-Za-z0-9_]/g, '_')}():\n    return 1\n`, 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');
  return problemDir;
}

test('problem import creates collapse on first import and skips an identical re-run', async () => {
  const repoRoot = resolveRepoRoot();
  const importer = await loadImporterModule();
  const store = importer.createInMemoryProblemImportStore();
  const definitions = importer.readProblemDefinitions(path.join(repoRoot, 'data', 'problems'));
  assert.equal(definitions[0].difficulty, 'easy');
  assert.deepEqual(definitions[0].tags, ['digits', 'iteration']);
  assert.equal(definitions[0].version, '1.0.0');
  assert.equal(definitions[0].author, 'COMP9021 Staff');
  assert.deepEqual(definitions[0].examples, [
    { inputJson: '111', expectedJson: '1' },
    { inputJson: '111122223333', expectedJson: '123' }
  ]);
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

test('problem import content digest changes when manifest metadata changes', async () => {
  const repoRoot = resolveRepoRoot();
  const importer = await loadImporterModule();
  const store = importer.createInMemoryProblemImportStore();
  const [collapse] = importer.readProblemDefinitions(path.join(repoRoot, 'data', 'problems'));

  await importer.importProblemDefinitions([collapse], store);

  const updated = {
    ...collapse,
    tags: [...(collapse.tags ?? []), 'manifest']
  };
  updated.contentDigest = importer.createContentDigest(updated);

  const result = await importer.importProblemDefinitions([updated], store);
  assert.deepEqual(result, {
    createdProblems: 0,
    createdVersions: 1,
    skipped: 0
  });
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
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Invalid manifest JSON at .*manifest\.json/
  );
});

test('problem import rejects missing hidden.json in the manifest layout', async () => {
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
      visibility: 'public',
      examples: [],
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Missing Tests\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /ENOENT|hidden\.json/
  );
});

test('problem import rejects invalid manifest field values for entryFunction, language, visibility, and limits', async () => {
  const importer = await loadImporterModule();
  const cases = [
    {
      name: 'invalid entryFunction',
      manifest: { problemId: 'bad-entry', entryFunction: '123 bad' },
      error: /valid Python entryFunction identifier/
    },
    {
      name: 'invalid language',
      manifest: { problemId: 'bad-language', language: 'javascript' },
      error: /must use language "python"/
    },
    {
      name: 'invalid visibility',
      manifest: { problemId: 'bad-visibility', visibility: 'internal' },
      error: /must use visibility "public" or "private"/
    },
    {
      name: 'non-positive time limit',
      manifest: { problemId: 'bad-time', timeLimitMs: 0 },
      error: /must define a positive timeLimitMs/
    },
    {
      name: 'non-positive memory limit',
      manifest: { problemId: 'bad-memory', memoryLimitKb: -1 },
      error: /must define a positive memoryLimitKb/
    }
  ] as const;

  for (const testCase of cases) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), `oj-${testCase.manifest.problemId}-`));
    const problemDir = await writeManifestProblem(tempRoot, testCase.manifest);

    assert.throws(
      () => importer.readProblemDefinition(problemDir),
      testCase.error,
      testCase.name
    );
  }
});

test('problem import rejects malformed examples, publicTests and hidden.json payloads', async () => {
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
      visibility: 'public',
      examples: '{not-json}',
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Bad Tests\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /must define examples as an array/
  );

  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'bad-tests',
      title: 'Bad Tests',
      entryFunction: 'run',
      language: 'python',
      timeLimitMs: 1000,
      memoryLimitKb: 1024,
      visibility: 'public',
      examples: [],
      publicTests: '{not-json}'
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Bad Tests\n', 'utf8');
  await writeFile(path.join(problemDir, 'starter.py'), 'def run():\n    return 1\n', 'utf8');
  await writeFile(path.join(problemDir, 'hidden.json'), '[]\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /must define publicTests as an array/
  );

  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'bad-tests',
      title: 'Bad Tests',
      entryFunction: 'run',
      language: 'python',
      timeLimitMs: 1000,
      memoryLimitKb: 1024,
      visibility: 'public',
      examples: [],
      publicTests: []
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'hidden.json'), '{not-json}\n', 'utf8');

  assert.throws(
    () => importer.readProblemDefinition(problemDir),
    /Expected JSON array|Invalid JSON/
  );
});

test('problem import treats starter.py as code-only and reads examples/public/hidden tests from explicit files', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-starter-only-'));
  const problemDir = path.join(tempRoot, 'starter-only');

  await mkdir(problemDir, { recursive: true });
  await writeFile(
    path.join(problemDir, 'manifest.json'),
    JSON.stringify({
      problemId: 'starter-only',
      title: 'Starter Only',
      entryFunction: 'run',
      language: 'python',
      timeLimitMs: 1000,
      memoryLimitKb: 1024,
      visibility: 'public',
      examples: [{ input: 1, output: 2 }],
      publicTests: [{ input: 2, output: 3 }]
    }),
    'utf8'
  );
  await writeFile(path.join(problemDir, 'statement.md'), '# Starter Only\n', 'utf8');
  await writeFile(
    path.join(problemDir, 'starter.py'),
    [
      'def run(value):',
      '    """Example implementation."""',
      '    # doctest-looking content here must not be treated as tests',
      '    # >>> run(10)',
      '    # 11',
      '    return value + 1',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    path.join(problemDir, 'hidden.json'),
    JSON.stringify([{ input: 9, output: 10 }]),
    'utf8'
  );

  const definition = importer.readProblemDefinition(problemDir);
  assert.deepEqual(definition.examples, [{ inputJson: '1', expectedJson: '2' }]);
  assert.deepEqual(definition.publicTests, [{ inputJson: '2', expectedJson: '3' }]);
  assert.deepEqual(definition.hiddenTests, [{ inputJson: '9', expectedJson: '10' }]);
});

test('runProblemImport rejects malformed manifests before any import succeeds', async () => {
  const importer = await loadImporterModule();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oj-manifest-run-import-'));
  const store = importer.createInMemoryProblemImportStore();

  await writeManifestProblem(tempRoot, {
    problemId: 'broken-manifest',
    entryFunction: 'bad entry'
  });

  await assert.rejects(
    importer.runProblemImport({ dir: tempRoot, store }),
    /valid Python entryFunction identifier/
  );
  assert.deepEqual(store.snapshot(), []);
});
