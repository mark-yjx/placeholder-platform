import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'packages', 'infrastructure', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for postgres problem repository tests');
}

function registerTsHook(): void {
  const existing = require.extensions['.ts'];
  if (existing) {
    return;
  }

  require.extensions['.ts'] = function registerTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      },
      fileName: filename
    });

    (module as NodeModule & { _compile: (code: string, fileName: string) => void })._compile(
      transpiled.outputText,
      filename
    );
  };
}

class FakePostgresProblemSqlClient {
  async query<T>(sql: string): Promise<readonly T[]> {
    if (sql.includes('FROM problem_version_assets pva')) {
      return [
        {
          entry_function: 'collapse',
          language: 'python',
          visibility: 'public',
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
          starter_code: 'def collapse(number):\n    return number\n',
          examples: [
            { inputJson: '111', expectedJson: '1' },
            { inputJson: '[1,2,3]', expectedJson: '{"ok":true}' },
            { input: 5, output: 3 }
          ]
        } satisfies {
          entry_function: string;
          language: string;
          visibility: 'public';
          time_limit_ms: number;
          memory_limit_kb: number;
          starter_code: string;
          examples: Array<Record<string, unknown>>;
        } as T
      ];
    }

    if (sql.includes('FROM problem_version_tests pvt')) {
      return [
        { input: 0, expected: 0 },
        { input: 12321, expected: 12321 }
      ] as T[];
    }

    throw new Error(`Unsupported query SQL in fake client: ${sql}`);
  }

  async execute(): Promise<void> {
    throw new Error('execute should not be called in manifest asset read test');
  }

  async withTransaction<T>(work: (client: any) => Promise<T>): Promise<T> {
    return work(this);
  }
}

function loadModule() {
  registerTsHook();
  return require(path.join(
    resolveRepoRoot(),
    'packages',
    'infrastructure',
    'src',
    'postgres',
    'problem',
    'PostgresProblemRepository.ts'
  )) as typeof import('../PostgresProblemRepository');
}

test('postgres problem repository maps stored example json fields into student-visible examples', async () => {
  const { PostgresProblemRepository } = loadModule();
  const repository = new PostgresProblemRepository(new FakePostgresProblemSqlClient());

  const assets = await repository.getManifestAssets('collapse-v5');
  assert.ok(assets);
  assert.deepEqual(assets.examples, [
    { input: 111, output: 1 },
    { input: [1, 2, 3], output: { ok: true } },
    { input: 5, output: 3 }
  ]);
  assert.deepEqual(assets.publicTests, [
    { input: 0, output: 0 },
    { input: 12321, output: 12321 }
  ]);
});
