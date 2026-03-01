import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'deploy', 'local', 'sql', 'migrations'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for queue integration tests');
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

function loadModule<T>(segments: string[]): T {
  registerTsHook();
  return require(path.join(resolveRepoRoot(), ...segments)) as T;
}

class FakeQueueAndSubmissionSqlClient {
  private readonly submissions = new Map<
    string,
    {
      id: string;
      owner_user_id: string;
      problem_id: string;
      problem_version_id: string;
      language: string;
      source_code: string;
      status: string;
      created_at: string;
    }
  >();

  private readonly judgeJobs = new Map<
    string,
    {
      submission_id: string;
      owner_user_id: string;
      problem_id: string;
      problem_version_id: string;
      language: string;
      source_code: string;
      created_at: string;
    }
  >();

  async query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> {
    if (sql.includes('FROM submissions') && sql.includes('WHERE id = $1')) {
      const row = this.submissions.get(String(params?.[0] ?? ''));
      return row ? [row as T] : [];
    }

    if (sql.includes('FROM judge_jobs')) {
      return Array.from(this.judgeJobs.values())
        .sort((left, right) =>
          left.created_at === right.created_at
            ? left.submission_id.localeCompare(right.submission_id)
            : left.created_at.localeCompare(right.created_at)
        ) as T[];
    }

    throw new Error(`Unsupported query SQL in fake client: ${sql}`);
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<void> {
    if (sql.includes('INSERT INTO submissions')) {
      const id = String(params?.[0] ?? '');
      this.submissions.set(id, {
        id,
        owner_user_id: String(params?.[1] ?? ''),
        problem_id: String(params?.[2] ?? ''),
        problem_version_id: String(params?.[3] ?? ''),
        language: String(params?.[4] ?? ''),
        source_code: String(params?.[5] ?? ''),
        status: String(params?.[6] ?? ''),
        created_at: new Date().toISOString()
      });
      return;
    }

    if (sql.includes('UPDATE submissions') && sql.includes('SET status = $2')) {
      const id = String(params?.[0] ?? '');
      const existing = this.submissions.get(id);
      if (!existing) {
        throw new Error('Submission not found');
      }
      this.submissions.set(id, {
        ...existing,
        status: String(params?.[1] ?? '')
      });
      return;
    }

    if (sql.includes('INSERT INTO judge_jobs')) {
      const submissionId = String(params?.[0] ?? '');
      if (!this.judgeJobs.has(submissionId)) {
        this.judgeJobs.set(submissionId, {
          submission_id: submissionId,
          owner_user_id: String(params?.[1] ?? ''),
          problem_id: String(params?.[2] ?? ''),
          problem_version_id: String(params?.[3] ?? ''),
          language: String(params?.[4] ?? ''),
          source_code: String(params?.[5] ?? ''),
          created_at: new Date().toISOString()
        });
      }
      return;
    }

    throw new Error(`Unsupported execute SQL in fake client: ${sql}`);
  }
}

test('judge jobs migration creates a queue table keyed by submission id', () => {
  const sql = fs.readFileSync(
    path.join(resolveRepoRoot(), 'deploy', 'local', 'sql', 'migrations', '004_judge_jobs.sql'),
    'utf8'
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS judge_jobs/i);
  assert.match(sql, /submission_id TEXT PRIMARY KEY REFERENCES submissions\(id\)/i);
  assert.match(sql, /owner_user_id TEXT NOT NULL REFERENCES users\(id\)/i);
});

test('creating a submission persists queued status and inserts a queue job referencing submission id', async () => {
  const { CreateSubmissionUseCase } = loadModule<
    typeof import('@packages/application/src/submission/CreateSubmissionUseCase')
  >(['packages', 'application', 'src', 'submission', 'CreateSubmissionUseCase.ts']);
  const { Role } = loadModule<typeof import('@packages/domain/src/identity')>([
    'packages',
    'domain',
    'src',
    'identity',
    'index.ts'
  ]);
  const { Problem, ProblemVersion } = loadModule<typeof import('@packages/domain/src/problem')>([
    'packages',
    'domain',
    'src',
    'problem',
    'index.ts'
  ]);
  const { SubmissionPolicyService } = loadModule<
    typeof import('@packages/domain/src/services')
  >(['packages', 'domain', 'src', 'services', 'index.ts']);
  const { SubmissionStatus } = loadModule<typeof import('@packages/domain/src/submission')>([
    'packages',
    'domain',
    'src',
    'submission',
    'index.ts'
  ]);
  const { PostgresJudgeJobQueue } = loadModule<
    typeof import('@packages/infrastructure/src/queue/PostgresJudgeJobQueue')
  >(['packages', 'infrastructure', 'src', 'queue', 'PostgresJudgeJobQueue.ts']);
  const { PostgresSubmissionRepository } = loadModule<
    typeof import('@packages/infrastructure/src/postgres/submission/PostgresSubmissionRepository')
  >([
    'packages',
    'infrastructure',
    'src',
    'postgres',
    'submission',
    'PostgresSubmissionRepository.ts'
  ]);

  const sqlClient = new FakeQueueAndSubmissionSqlClient();
  const submissions = new PostgresSubmissionRepository(sqlClient);
  const queue = new PostgresJudgeJobQueue(sqlClient);
  const problem = new Problem('problem-1', [
    ProblemVersion.createDraft({
      id: 'problem-1-v1',
      versionNumber: 1,
      title: 'Echo',
      statement: 'Print input'
    }).publish()
  ]);
  const createSubmission = new CreateSubmissionUseCase(
    {
      async findById(id: string) {
        return id === problem.id ? problem : null;
      },
      async save() {
        throw new Error('not used in this test');
      }
    },
    submissions,
    queue,
    new SubmissionPolicyService()
  );

  const record = await createSubmission.execute({
    submissionId: 'submission-1',
    actorUserId: 'student-1',
    actorRoles: [Role.STUDENT],
    problemId: 'problem-1',
    language: 'python',
    sourceCode: 'print(42)'
  });

  assert.equal(record.status, SubmissionStatus.QUEUED);

  const persistedSubmission = await submissions.findById('submission-1');
  assert.equal(persistedSubmission?.status, SubmissionStatus.QUEUED);

  const jobs = await queue.listJobs();
  assert.deepEqual(jobs, [
    {
      submissionId: 'submission-1',
      ownerUserId: 'student-1',
      problemId: 'problem-1',
      problemVersionId: 'problem-1-v1',
      language: 'python',
      sourceCode: 'print(42)'
    }
  ]);
});
