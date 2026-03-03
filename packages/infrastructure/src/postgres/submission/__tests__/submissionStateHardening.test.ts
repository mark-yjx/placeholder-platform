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
  throw new Error('Unable to resolve repository root for submission repository tests');
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

type SubmissionRow = {
  id: string;
  owner_user_id: string;
  problem_id: string;
  problem_version_id: string;
  language: string;
  source_code: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
};

class FakePostgresSubmissionSqlClient {
  private readonly rows = new Map<string, SubmissionRow>();

  async query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> {
    if (sql.includes('WHERE id = $1')) {
      const row = this.rows.get(String(params?.[0] ?? ''));
      return row ? [row as T] : [];
    }

    if (sql.includes('FROM submissions') && sql.includes('ORDER BY created_at DESC, id DESC')) {
      return Array.from(this.rows.values()).sort((left, right) => {
        const createdAtDiff =
          Date.parse(right.created_at) - Date.parse(left.created_at);
        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }
        return right.id.localeCompare(left.id);
      }) as T[];
    }

    throw new Error(`Unsupported query SQL in fake client: ${sql}`);
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<void> {
    if (sql.includes('INSERT INTO submissions')) {
      const id = String(params?.[0] ?? '');
      this.rows.set(id, {
        id,
        owner_user_id: String(params?.[1] ?? ''),
        problem_id: String(params?.[2] ?? ''),
        problem_version_id: String(params?.[3] ?? ''),
        language: String(params?.[4] ?? ''),
        source_code: String(params?.[5] ?? ''),
        status: String(params?.[6] ?? ''),
        failure_reason: params?.[7] == null ? null : String(params[7]),
        created_at: new Date().toISOString()
      });
      return;
    }

    if (sql.includes('UPDATE submissions') && sql.includes('SET status = $2')) {
      const id = String(params?.[0] ?? '');
      const existing = this.rows.get(id);
      if (!existing) {
        throw new Error('Submission not found');
      }
      this.rows.set(id, {
        ...existing,
        status: String(params?.[1] ?? ''),
        failure_reason: params?.[2] == null ? null : String(params[2])
      });
      return;
    }

    if (sql.includes('DELETE FROM submissions')) {
      this.rows.delete(String(params?.[0] ?? ''));
      return;
    }

    throw new Error(`Unsupported execute SQL in fake client: ${sql}`);
  }
}

function loadSubmissionRepositoryModule() {
  const repoRoot = resolveRepoRoot();
  registerTsHook();
  return require(path.join(
    repoRoot,
    'packages',
    'infrastructure',
    'src',
    'postgres',
    'submission',
    'PostgresSubmissionRepository.ts'
  )) as typeof import('../PostgresSubmissionRepository');
}

function loadSubmissionStatusModule() {
  const repoRoot = resolveRepoRoot();
  registerTsHook();
  return require(path.join(
    repoRoot,
    'packages',
    'domain',
    'src',
    'submission',
    'SubmissionStatus.ts'
  )) as typeof import('@packages/domain/src/submission');
}

test('postgres submission repository preserves status across repository restart simulation', async () => {
  const { PostgresSubmissionRepository } = loadSubmissionRepositoryModule();
  const { SubmissionStatus } = loadSubmissionStatusModule();
  const client = new FakePostgresSubmissionSqlClient();

  const repository = new PostgresSubmissionRepository(client);
  await repository.save({
    id: 'submission-1',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(1)',
    status: SubmissionStatus.QUEUED
  });

  await repository.save({
    id: 'submission-1',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(1)',
    status: SubmissionStatus.RUNNING
  });

  const restartedRepository = new PostgresSubmissionRepository(client);
  const persisted = await restartedRepository.findById('submission-1');
  assert.equal(persisted?.status, SubmissionStatus.RUNNING);
  assert.equal(persisted?.failureReason, undefined);
});

test('postgres submission repository enforces queued -> running -> finished and terminal immutability', async () => {
  const { PostgresSubmissionRepository } = loadSubmissionRepositoryModule();
  const { SubmissionStatus } = loadSubmissionStatusModule();
  const client = new FakePostgresSubmissionSqlClient();
  const repository = new PostgresSubmissionRepository(client);

  await repository.save({
    id: 'submission-2',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(2)',
    status: SubmissionStatus.QUEUED
  });

  await repository.save({
    id: 'submission-2',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(2)',
    status: SubmissionStatus.RUNNING
  });

  await repository.save({
    id: 'submission-2',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(2)',
    status: SubmissionStatus.FINISHED
  });

  await assert.rejects(
    repository.save({
      id: 'submission-2',
      ownerUserId: 'student-1',
      problemId: 'problem-1',
      problemVersionId: 'problem-1-v1',
      language: 'python',
      sourceCode: 'print(2)',
      status: SubmissionStatus.FAILED
    }),
    /Invalid transition: finished -> failed/
  );
});

test('postgres submission repository rejects invalid direct queued -> finished transition', async () => {
  const { PostgresSubmissionRepository } = loadSubmissionRepositoryModule();
  const { SubmissionStatus } = loadSubmissionStatusModule();
  const client = new FakePostgresSubmissionSqlClient();
  const repository = new PostgresSubmissionRepository(client);

  await repository.save({
    id: 'submission-3',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(3)',
    status: SubmissionStatus.QUEUED
  });

  await assert.rejects(
    repository.save({
      id: 'submission-3',
      ownerUserId: 'student-1',
      problemId: 'problem-1',
      problemVersionId: 'problem-1-v1',
      language: 'python',
      sourceCode: 'print(3)',
      status: SubmissionStatus.FINISHED
    }),
    /Invalid transition: queued -> finished/
  );
});

test('postgres submission repository persists failure reason on running -> failed transition', async () => {
  const { PostgresSubmissionRepository } = loadSubmissionRepositoryModule();
  const { SubmissionStatus } = loadSubmissionStatusModule();
  const client = new FakePostgresSubmissionSqlClient();
  const repository = new PostgresSubmissionRepository(client);

  await repository.save({
    id: 'submission-4',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(4)',
    status: SubmissionStatus.QUEUED
  });

  await repository.save({
    id: 'submission-4',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(4)',
    status: SubmissionStatus.RUNNING
  });

  await repository.save({
    id: 'submission-4',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(4)',
    status: SubmissionStatus.FAILED,
    failureReason: 'sandbox could not start'
  });

  const persisted = await repository.findById('submission-4');
  assert.equal(persisted?.status, SubmissionStatus.FAILED);
  assert.equal(persisted?.failureReason, 'sandbox could not start');
});
