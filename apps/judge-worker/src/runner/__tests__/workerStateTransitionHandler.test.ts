import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'judge-worker', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for worker state transition tests');
}

function registerTsHook(): void {
  const existing = require.extensions['.ts'];
  if (!existing) {
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

  const moduleWithResolve = Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) => string;
  };

  const resolver = moduleWithResolve._resolveFilename as (
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
    options?: unknown
  ) => string;

  if (!(globalThis as { __worker_test_aliases_installed__?: boolean }).__worker_test_aliases_installed__) {
    const repoRoot = resolveRepoRoot();
    moduleWithResolve._resolveFilename = function resolveWithAliases(
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) {
      if (request === '@placeholder/contracts/src') {
        return resolver(
          path.join(repoRoot, 'packages', 'contracts', 'src', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      return resolver(request, parent, isMain, options);
    };
    (globalThis as { __worker_test_aliases_installed__?: boolean }).__worker_test_aliases_installed__ = true;
  }
}

function loadWorkerStateTransitionHandler() {
  registerTsHook();
  return require(path.join(
    resolveRepoRoot(),
    'apps',
    'judge-worker',
    'src',
    'WorkerStateTransitionHandler.ts'
  )) as typeof import('../../WorkerStateTransitionHandler');
}

type WorkerSubmissionStatus = 'queued' | 'running' | 'finished' | 'failed';
type WorkerSubmissionRecord = {
  id: string;
  ownerUserId: string;
  problemId: string;
  problemVersionId: string;
  language: string;
  sourceCode: string;
  status: WorkerSubmissionStatus;
};
type JudgeJob = {
  submissionId: string;
  ownerUserId: string;
  problemId: string;
  problemVersionId: string;
  language: string;
  sourceCode: string;
};

class FakeQueue {
  readonly acknowledged: string[] = [];

  constructor(private nextJob: JudgeJob | null) {}

  async claimNext(): Promise<JudgeJob | null> {
    const claimed = this.nextJob;
    this.nextJob = null;
    return claimed;
  }

  async acknowledge(submissionId: string): Promise<void> {
    this.acknowledged.push(submissionId);
  }
}

class FakeSubmissionRepository {
  readonly saves: { id: string; status: WorkerSubmissionStatus }[] = [];

  constructor(
    private readonly records = new Map<string, WorkerSubmissionRecord>()
  ) {}

  async findById(id: string): Promise<WorkerSubmissionRecord | null> {
    return this.records.get(id) ?? null;
  }

  async save(record: WorkerSubmissionRecord): Promise<void> {
    this.saves.push({ id: record.id, status: record.status });
    this.records.set(record.id, { ...record });
  }
}

function createQueuedSubmission(id: string): WorkerSubmissionRecord {
  return {
    id,
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(42)',
    status: 'queued'
  };
}

function createJob(submissionId: string): JudgeJob {
  return {
    submissionId,
    ownerUserId: 'student-1',
    problemId: 'problem-1',
    problemVersionId: 'problem-1-v1',
    language: 'python',
    sourceCode: 'print(42)'
  };
}

test('worker consumes queued job and transitions submission to running then finished', async () => {
  const { processNextJudgeJob } = loadWorkerStateTransitionHandler();
  const queue = new FakeQueue(createJob('submission-1'));
  const submissions = new FakeSubmissionRepository(
    new Map([['submission-1', createQueuedSubmission('submission-1')]])
  );

  const result = await processNextJudgeJob({
    queue,
    submissions,
    execution: {
      async execute() {
        return { status: 'finished' as const };
      }
    }
  });

  assert.deepEqual(result, {
    outcome: 'processed',
    submissionId: 'submission-1',
    status: 'finished'
  });
  assert.deepEqual(submissions.saves, [
    { id: 'submission-1', status: 'running' },
    { id: 'submission-1', status: 'finished' }
  ]);
  assert.deepEqual(queue.acknowledged, ['submission-1']);
});

test('worker transitions submission to failed when execution completes with failure', async () => {
  const { processNextJudgeJob } = loadWorkerStateTransitionHandler();
  const queue = new FakeQueue(createJob('submission-2'));
  const submissions = new FakeSubmissionRepository(
    new Map([['submission-2', createQueuedSubmission('submission-2')]])
  );

  const result = await processNextJudgeJob({
    queue,
    submissions,
    execution: {
      async execute() {
        return { status: 'failed' as const };
      }
    }
  });

  assert.deepEqual(result, {
    outcome: 'processed',
    submissionId: 'submission-2',
    status: 'failed'
  });
  assert.deepEqual(submissions.saves, [
    { id: 'submission-2', status: 'running' },
    { id: 'submission-2', status: 'failed' }
  ]);
  assert.deepEqual(queue.acknowledged, ['submission-2']);
});

test('worker crash during execution does not incorrectly mark submission as finished', async () => {
  const { processNextJudgeJob } = loadWorkerStateTransitionHandler();
  const queue = new FakeQueue(createJob('submission-3'));
  const submissions = new FakeSubmissionRepository(
    new Map([['submission-3', createQueuedSubmission('submission-3')]])
  );

  await assert.rejects(
    processNextJudgeJob({
      queue,
      submissions,
      execution: {
        async execute() {
          throw new Error('worker crashed');
        }
      }
    }),
    /worker crashed/
  );

  assert.deepEqual(submissions.saves, [
    { id: 'submission-3', status: 'running' }
  ]);
  assert.deepEqual(queue.acknowledged, []);
});

test('worker returns idle when no queued job is available', async () => {
  const { processNextJudgeJob } = loadWorkerStateTransitionHandler();
  const queue = new FakeQueue(null);
  const submissions = new FakeSubmissionRepository();

  const result = await processNextJudgeJob({
    queue,
    submissions,
    execution: {
      async execute() {
        return { status: 'finished' as const };
      }
    }
  });

  assert.deepEqual(result, { outcome: 'idle' });
  assert.deepEqual(submissions.saves, []);
  assert.deepEqual(queue.acknowledged, []);
});
