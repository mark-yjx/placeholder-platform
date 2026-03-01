import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Verdict } from '@packages/domain/src/judge';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'api', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for result persistence contract tests');
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

type SubmissionStatusValue = 'queued' | 'running' | 'finished' | 'failed';

class InMemorySubmissionStateRepository {
  private readonly records = new Map<
    string,
    {
      id: string;
      ownerUserId: string;
      problemId: string;
      problemVersionId: string;
      language: string;
      sourceCode: string;
      status: SubmissionStatusValue;
    }
  >();

  constructor(seed: {
    id: string;
    ownerUserId: string;
    problemId: string;
    problemVersionId: string;
    language: string;
    sourceCode: string;
    status: SubmissionStatusValue;
  }) {
    this.records.set(seed.id, { ...seed });
  }

  async findById(id: string) {
    return this.records.get(id) ?? null;
  }

  async save(record: {
    id: string;
    ownerUserId: string;
    problemId: string;
    problemVersionId: string;
    language: string;
    sourceCode: string;
    status: SubmissionStatusValue;
  }) {
    this.records.set(record.id, { ...record });
  }

  async listAll() {
    return Array.from(this.records.values());
  }
}

class GuardedInMemoryJudgeResultRepository {
  private readonly results = new Map<
    string,
    { submissionId: string; verdict: Verdict; timeMs: number; memoryKb: number }
  >();

  async findBySubmissionId(submissionId: string) {
    return this.results.get(submissionId) ?? null;
  }

  async save(result: {
    submissionId: string;
    verdict: Verdict;
    timeMs: number;
    memoryKb: number;
  }) {
    const existing = this.results.get(result.submissionId);
    if (existing) {
      const same =
        existing.verdict === result.verdict &&
        existing.timeMs === result.timeMs &&
        existing.memoryKb === result.memoryKb;
      if (!same) {
        throw new Error('Judge result is immutable once persisted');
      }
      return;
    }
    this.results.set(result.submissionId, { ...result });
  }
}

test('duplicate judge callback ingestion does not overwrite terminal state and returns persisted result view', async () => {
  const { JudgeCallbackIngestionService, ResultQueryService } = loadModule<
    typeof import('@packages/application/src/results')
  >(['packages', 'application', 'src', 'results', 'index.ts']);
  const submissions = new InMemorySubmissionStateRepository({
    id: 'submission-1',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(42)',
    status: 'running'
  });
  const results = new GuardedInMemoryJudgeResultRepository();
  const ingestion = new JudgeCallbackIngestionService(submissions as never, results as never);

  const first = await ingestion.ingest({
    submissionId: 'submission-1',
    verdict: 'AC' as Verdict,
    timeMs: 120,
    memoryKb: 2048
  });
  const second = await ingestion.ingest({
    submissionId: 'submission-1',
    verdict: 'AC' as Verdict,
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(first, second);
  assert.equal((await submissions.findById('submission-1'))?.status, 'finished');

  const studentHistory = await new ResultQueryService(
    submissions as never,
    results as never
  ).getStudentSubmissionHistory('student-1');

  assert.deepEqual(studentHistory, [
    {
      submissionId: 'submission-1',
      ownerUserId: 'student-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    }
  ]);
});

test('conflicting duplicate judge callback is rejected and terminal result remains immutable', async () => {
  const { JudgeCallbackIngestionService } = loadModule<
    typeof import('@packages/application/src/results')
  >(['packages', 'application', 'src', 'results', 'index.ts']);
  const submissions = new InMemorySubmissionStateRepository({
    id: 'submission-2',
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(42)',
    status: 'finished'
  });
  const results = new GuardedInMemoryJudgeResultRepository();
  await results.save({
    submissionId: 'submission-2',
    verdict: 'WA' as Verdict,
    timeMs: 140,
    memoryKb: 2052
  });

  const ingestion = new JudgeCallbackIngestionService(submissions as never, results as never);

  await assert.rejects(
    ingestion.ingest({
      submissionId: 'submission-2',
      verdict: 'RE' as Verdict,
      timeMs: 999,
      memoryKb: 9999
    }),
    /Conflicting judge callback/
  );

  const persisted = await results.findBySubmissionId('submission-2');
  assert.deepEqual(persisted, {
    submissionId: 'submission-2',
    verdict: 'WA',
    timeMs: 140,
    memoryKb: 2052
  });
  assert.equal((await submissions.findById('submission-2'))?.status, 'finished');
});
