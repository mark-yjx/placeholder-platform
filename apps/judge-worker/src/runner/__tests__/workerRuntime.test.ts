import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
import { DockerSandboxAdapter } from '../../sandbox/DockerSandboxAdapter';
import { RunnerRegistry } from '../../runner/RunnerRegistry';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'judge-worker', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for worker runtime tests');
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

  if (!(globalThis as { __worker_runtime_aliases_installed__?: boolean }).__worker_runtime_aliases_installed__) {
    const repoRoot = resolveRepoRoot();
    const resolver = moduleWithResolve._resolveFilename.bind(moduleWithResolve);
    moduleWithResolve._resolveFilename = function resolveWithAliases(
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) {
      if (request === '@packages/infrastructure/src') {
        return resolver(
          path.join(repoRoot, 'packages', 'infrastructure', 'src', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      if (request === '@packages/domain/src/judge') {
        return resolver(
          path.join(repoRoot, 'packages', 'domain', 'src', 'judge', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      if (request === '@packages/domain/src/submission') {
        return resolver(
          path.join(repoRoot, 'packages', 'domain', 'src', 'submission', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      return resolver(request, parent, isMain, options);
    };
    (globalThis as { __worker_runtime_aliases_installed__?: boolean }).__worker_runtime_aliases_installed__ = true;
  }
}

function loadWorkerRuntime() {
  registerTsHook();
  return require(path.join(
    resolveRepoRoot(),
    'apps',
    'judge-worker',
    'src',
    'workerRuntime.ts'
  )) as typeof import('../../workerRuntime');
}

test('worker runtime starts, idles with ticks, and stops cleanly', async () => {
  const { startWorkerRuntime } = loadWorkerRuntime();
  let ticks = 0;
  const logs: string[] = [];

  const runtime = startWorkerRuntime({
    pollIntervalMs: 5,
    onTick: async () => {
      ticks += 1;
    },
    logger: {
      info: (message) => logs.push(message),
      error: (message) => logs.push(message)
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  await runtime.stop();

  assert.ok(ticks > 0);
  assert.ok(logs.includes('worker.runtime.started'));
  assert.ok(logs.includes('worker.runtime.stopped'));
});

test('worker runtime resolves docker image after flags that include colon-valued arguments', () => {
  const { __internal__ } = loadWorkerRuntime();

  assert.equal(
    __internal__.resolveDockerRunImage([
      'run',
      '--rm',
      '--cpus',
      '1',
      '--memory',
      '128m',
      '--network',
      'none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt',
      'no-new-privileges',
      '--pids-limit',
      '64',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=64m',
      'python:3.12-alpine',
      'python',
      '/sandbox/main.py'
    ]),
    'python:3.12-alpine'
  );
});

test('worker tick uses problem tests and records AC for a correct submission', async () => {
  const { createWorkerTick } = loadWorkerRuntime();
  const savedResults: Array<{ verdict: string; timeMs: number; memoryKb: number }> = [];
  let acknowledgedSubmissionId = '';
  let currentStatus = 'queued';

  const tick = createWorkerTick({
    queue: {
      async claimNext() {
        return {
          submissionId: 'submission-1',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v1',
          language: 'python',
          sourceCode: 'def collapse(number):\n    return 0 if number == 0 else int(str(number)[0])\n'
        };
      },
      async acknowledge(submissionId: string) {
        acknowledgedSubmissionId = submissionId;
      }
    },
    submissions: {
      async findById() {
        return {
          id: 'submission-1',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v1',
          language: 'python',
          sourceCode: 'def collapse(number):\n    return 0 if number == 0 else int(str(number)[0])\n',
          status: currentStatus as import('@packages/domain/src/submission').SubmissionStatus
        };
      },
      async save(submission) {
        currentStatus = submission.status;
      }
    },
    results: {
      async findBySubmissionId() {
        return null;
      },
      async save(result) {
        savedResults.push(result);
      }
    },
    judgeConfigs: {
      async findByProblemVersionId() {
        return {
          entryFunction: 'collapse',
          tests: [{ testType: 'public', position: 1, inputJson: '0', expectedJson: '0' }]
        };
      }
    },
    sandbox: new DockerSandboxAdapter(async () => {
      return {
        stdout: '0\n',
        stderr: '',
        exitCode: 0,
        timeMs: 15,
        memoryKb: 512
      };
    }),
    runners: new RunnerRegistry([
      {
        language: 'python',
        resolve() {
          return { language: 'python', runArgs: ['python', '/sandbox/main.py'] };
        }
      }
    ]),
    image: 'python:3.12-alpine'
  });

  await tick();

  assert.equal(currentStatus, 'finished');
  assert.equal(acknowledgedSubmissionId, 'submission-1');
  assert.deepEqual(savedResults, [
    { submissionId: 'submission-1', verdict: 'AC', timeMs: 15, memoryKb: 512 }
  ]);
});

test('worker tick returns WA when hidden tests fail and result does not leak hidden input/output', async () => {
  const { createWorkerTick } = loadWorkerRuntime();
  const savedResults: Array<Record<string, unknown>> = [];
  let executeCount = 0;

  const tick = createWorkerTick({
    queue: {
      async claimNext() {
        return {
          submissionId: 'submission-2',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def collapse(number):\n    return number\n'
        };
      },
      async acknowledge() {
        return;
      }
    },
    submissions: {
      async findById() {
        return {
          id: 'submission-2',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def collapse(number):\n    return number\n',
          status: 'queued' as import('@packages/domain/src/submission').SubmissionStatus
        };
      },
      async save() {
        return;
      }
    },
    results: {
      async findBySubmissionId() {
        return null;
      },
      async save(result) {
        savedResults.push(result as unknown as Record<string, unknown>);
      }
    },
    judgeConfigs: {
      async findByProblemVersionId() {
        return {
          entryFunction: 'collapse',
          tests: [
            { testType: 'public', position: 1, inputJson: '12321', expectedJson: '12321' },
            { testType: 'hidden', position: 1, inputJson: '-900111212777394440300', expectedJson: '-9012127394030' }
          ]
        };
      }
    },
    sandbox: new DockerSandboxAdapter(async () => {
      executeCount += 1;
      return {
        stdout: executeCount === 1 ? '12321\n' : '-900111212777394440300\n',
        stderr: '',
        exitCode: 0,
        timeMs: 20,
        memoryKb: 1024
      };
    }),
    runners: new RunnerRegistry([
      {
        language: 'python',
        resolve() {
          return { language: 'python', runArgs: ['python', '/sandbox/main.py'] };
        }
      }
    ]),
    image: 'python:3.12-alpine'
  });

  await tick();

  assert.deepEqual(savedResults, [
    {
      submissionId: 'submission-2',
      verdict: 'WA',
      timeMs: 40,
      memoryKb: 1024
    }
  ]);
  assert.equal('input' in savedResults[0], false);
  assert.equal('expected' in savedResults[0], false);
});

test('worker tick marks submission failed with CE and acknowledges job when judge config is missing', async () => {
  const { createWorkerTick } = loadWorkerRuntime();
  const savedSubmissions: Array<{ status: string; failureReason?: string }> = [];
  const savedResults: Array<{ submissionId: string; verdict: string; timeMs: number; memoryKb: number }> = [];
  let acknowledgedSubmissionId = '';

  const tick = createWorkerTick({
    queue: {
      async claimNext() {
        return {
          submissionId: 'submission-missing-config',
          ownerUserId: 'student-1',
          problemId: 'problem-1',
          problemVersionId: 'problem-1-v1',
          language: 'python',
          sourceCode: 'def solve():\n    return 42\n'
        };
      },
      async acknowledge(submissionId: string) {
        acknowledgedSubmissionId = submissionId;
      }
    },
    submissions: {
      async findById() {
        return {
          id: 'submission-missing-config',
          ownerUserId: 'student-1',
          problemId: 'problem-1',
          problemVersionId: 'problem-1-v1',
          language: 'python',
          sourceCode: 'def solve():\n    return 42\n',
          status: 'queued' as import('@packages/domain/src/submission').SubmissionStatus
        };
      },
      async save(submission) {
        savedSubmissions.push({
          status: submission.status,
          failureReason: submission.failureReason
        });
      }
    },
    results: {
      async findBySubmissionId() {
        return null;
      },
      async save(result) {
        savedResults.push(result);
      }
    },
    judgeConfigs: {
      async findByProblemVersionId() {
        return null;
      }
    },
    sandbox: new DockerSandboxAdapter(async () => {
      throw new Error('sandbox should not be invoked when judge config is missing');
    }),
    runners: new RunnerRegistry([
      {
        language: 'python',
        resolve() {
          return { language: 'python', runArgs: ['python', '/sandbox/main.py'] };
        }
      }
    ]),
    image: 'python:3.12-alpine'
  });

  await tick();

  assert.deepEqual(savedSubmissions, [
    { status: 'running', failureReason: undefined },
    {
      status: 'failed',
      failureReason: 'Judge config not found for problem version problem-1-v1'
    }
  ]);
  assert.deepEqual(savedResults, [
    {
      submissionId: 'submission-missing-config',
      verdict: 'CE',
      timeMs: 0,
      memoryKb: 0
    }
  ]);
  assert.equal(acknowledgedSubmissionId, 'submission-missing-config');
});

test('worker tick persists failure reason and acknowledges job when result ingestion fails', async () => {
  const { createWorkerTick } = loadWorkerRuntime();
  const workerLogs: Array<Record<string, unknown>> = [];
  const savedSubmissions: Array<{ status: string; failureReason?: string }> = [];
  let acknowledgedSubmissionId = '';

  const tick = createWorkerTick({
    queue: {
      async claimNext() {
        return {
          submissionId: 'submission-result-error',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def solve(*args):\n    return 0\n'
        };
      },
      async acknowledge(submissionId: string) {
        acknowledgedSubmissionId = submissionId;
      }
    },
    submissions: {
      async findById() {
        return {
          id: 'submission-result-error',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def solve(*args):\n    return 0\n',
          status: 'queued' as import('@packages/domain/src/submission').SubmissionStatus
        };
      },
      async save(submission) {
        savedSubmissions.push({
          status: submission.status,
          failureReason: submission.failureReason
        });
      }
    },
    results: {
      async findBySubmissionId() {
        return null;
      },
      async save() {
        throw new Error('judge result write failed');
      }
    },
    judgeConfigs: {
      async findByProblemVersionId() {
        return {
          entryFunction: 'solve',
          tests: [{ testType: 'public', position: 1, inputJson: '1', expectedJson: '0' }]
        };
      }
    },
    sandbox: new DockerSandboxAdapter(async () => {
      return {
        stdout: '0\n',
        stderr: '',
        exitCode: 0,
        timeMs: 9,
        memoryKb: 128
      };
    }),
    runners: new RunnerRegistry([
      {
        language: 'python',
        resolve() {
          return { language: 'python', runArgs: ['python', '/sandbox/main.py'] };
        }
      }
    ]),
    image: 'python:3.12-alpine'
  });

  const originalConsoleLog = console.log;
  console.log = (entry: unknown) => {
    if (entry && typeof entry === 'object') {
      workerLogs.push(entry as Record<string, unknown>);
    }
  };

  try {
    await tick();
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(acknowledgedSubmissionId, 'submission-result-error');
  assert.deepEqual(savedSubmissions, [
    { status: 'running', failureReason: undefined },
    { status: 'failed', failureReason: 'judge result write failed' }
  ]);
  assert.equal(
    workerLogs.some(
      (entry) =>
        entry.message === 'worker.submission.failed' &&
        entry.jobId === 'submission-result-error' &&
        (entry.fields as { submissionId?: string; error?: string } | undefined)?.submissionId ===
          'submission-result-error' &&
        (entry.fields as { submissionId?: string; error?: string } | undefined)?.error ===
          'judge result write failed'
    ),
    true
  );
});

test('worker tick acknowledges and logs duplicate completion without rewriting terminal result', async () => {
  const { createWorkerTick } = loadWorkerRuntime();
  const logs: string[] = [];
  const savedStatuses: string[] = [];
  const savedResults: Array<Record<string, unknown>> = [];
  const sandboxCalls: string[] = [];
  let acknowledgedSubmissionId = '';

  const tick = createWorkerTick({
    queue: {
      async claimNext() {
        return {
          submissionId: 'submission-duplicate',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def solve(*args):\n    return 0\n'
        };
      },
      async acknowledge(submissionId: string) {
        acknowledgedSubmissionId = submissionId;
      }
    },
    submissions: {
      async findById() {
        return {
          id: 'submission-duplicate',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          problemVersionId: 'collapse-v2',
          language: 'python',
          sourceCode: 'def solve(*args):\n    return 0\n',
          status: 'finished' as import('@packages/domain/src/submission').SubmissionStatus
        };
      },
      async save(submission) {
        savedStatuses.push(submission.status);
      }
    },
    results: {
      async findBySubmissionId() {
        return {
          submissionId: 'submission-duplicate',
          verdict: 'WA' as import('@packages/domain/src/judge').Verdict,
          timeMs: 1083,
          memoryKb: 0
        };
      },
      async save(result) {
        savedResults.push(result as unknown as Record<string, unknown>);
      }
    },
    judgeConfigs: {
      async findByProblemVersionId() {
        throw new Error('judge config lookup should not run for duplicate terminal completion');
      }
    },
    sandbox: new DockerSandboxAdapter(async () => {
      sandboxCalls.push('executed');
      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        timeMs: 1,
        memoryKb: 1
      };
    }),
    runners: new RunnerRegistry([
      {
        language: 'python',
        resolve() {
          return { language: 'python', runArgs: ['python', '/sandbox/main.py'] };
        }
      }
    ]),
    image: 'python:3.12-alpine',
    logger: {
      info: (message) => logs.push(message)
    }
  });

  await tick();

  assert.equal(acknowledgedSubmissionId, 'submission-duplicate');
  assert.deepEqual(savedStatuses, []);
  assert.deepEqual(savedResults, []);
  assert.deepEqual(sandboxCalls, []);
  assert.deepEqual(logs, [
    'worker.job.duplicate_ignored submissionId=submission-duplicate status=finished'
  ]);
});
