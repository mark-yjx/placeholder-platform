import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Verdict } from '@placeholder/domain/src/judge';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'packages', 'infrastructure', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for judge result repository tests');
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

class FakePostgresJudgeResultSqlClient {
  private readonly rows = new Map<
    string,
    { submission_id: string; verdict: string; time_ms: number | null; memory_kb: number | null }
  >();

  async query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> {
    if (sql.includes('FROM judge_results') && sql.includes('WHERE submission_id = $1')) {
      const row = this.rows.get(String(params?.[0] ?? ''));
      return row ? [row as T] : [];
    }

    throw new Error(`Unsupported query SQL in fake client: ${sql}`);
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<void> {
    if (sql.includes('INSERT INTO judge_results')) {
      const submissionId = String(params?.[0] ?? '');
      this.rows.set(submissionId, {
        submission_id: submissionId,
        verdict: String(params?.[1] ?? ''),
        time_ms: params?.[2] == null ? null : Number(params[2]),
        memory_kb: params?.[3] == null ? null : Number(params[3])
      });
      return;
    }

    throw new Error(`Unsupported execute SQL in fake client: ${sql}`);
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
    'results',
    'PostgresJudgeResultRepository.ts'
  )) as typeof import('../PostgresJudgeResultRepository');
}

test('postgres judge result repository persists and reads verdict/time/memory', async () => {
  const { PostgresJudgeResultRepository } = loadModule();
  const repository = new PostgresJudgeResultRepository(new FakePostgresJudgeResultSqlClient());

  await repository.save({
    submissionId: 'submission-1',
    verdict: 'AC' as Verdict,
    timeMs: 120,
    memoryKb: 2048
  });

  const persisted = await repository.findBySubmissionId('submission-1');
  assert.deepEqual(persisted, {
    submissionId: 'submission-1',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });
});

test('postgres judge result repository is idempotent for duplicate identical results', async () => {
  const { PostgresJudgeResultRepository } = loadModule();
  const repository = new PostgresJudgeResultRepository(new FakePostgresJudgeResultSqlClient());

  await repository.save({
    submissionId: 'submission-2',
    verdict: 'WA' as Verdict,
    timeMs: 140,
    memoryKb: 2052
  });

  await repository.save({
    submissionId: 'submission-2',
    verdict: 'WA' as Verdict,
    timeMs: 140,
    memoryKb: 2052
  });

  const persisted = await repository.findBySubmissionId('submission-2');
  assert.deepEqual(persisted, {
    submissionId: 'submission-2',
    verdict: 'WA',
    timeMs: 140,
    memoryKb: 2052
  });
});

test('postgres judge result repository rejects conflicting overwrite of terminal result', async () => {
  const { PostgresJudgeResultRepository } = loadModule();
  const repository = new PostgresJudgeResultRepository(new FakePostgresJudgeResultSqlClient());

  await repository.save({
    submissionId: 'submission-3',
    verdict: 'AC' as Verdict,
    timeMs: 100,
    memoryKb: 2000
  });

  await assert.rejects(
    repository.save({
      submissionId: 'submission-3',
      verdict: 'RE' as Verdict,
      timeMs: 300,
      memoryKb: 4096
    }),
    /Judge result is immutable once persisted/
  );
});

test('postgres judge result repository preserves unavailable runtime metrics as null-backed fields', async () => {
  const { PostgresJudgeResultRepository } = loadModule();
  const repository = new PostgresJudgeResultRepository(new FakePostgresJudgeResultSqlClient());

  await repository.save({
    submissionId: 'submission-4',
    verdict: 'CE' as Verdict,
    timeMs: undefined,
    memoryKb: undefined
  });

  const persisted = await repository.findBySubmissionId('submission-4');
  assert.deepEqual(persisted, {
    submissionId: 'submission-4',
    verdict: 'CE',
    timeMs: undefined,
    memoryKb: undefined
  });
});
