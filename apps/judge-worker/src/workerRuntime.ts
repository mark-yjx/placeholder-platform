import { spawn } from 'node:child_process';
import { PostgresJudgeResultRepository, PostgresJudgeJobQueue, PostgresSubmissionRepository } from '@packages/infrastructure/src';
import type { Verdict } from '@packages/domain/src/judge';
import type { SubmissionStatus } from '@packages/domain/src/submission';
import { createWorkerLogger } from './observability/WorkerLogger';
import { PythonRunnerPlugin } from './runner/PythonRunnerPlugin';
import { RunnerRegistry } from './runner/RunnerRegistry';
import { createLocalPostgresSqlClient } from './runtime/localPostgresSqlClient';
import { DockerSandboxAdapter } from './sandbox/DockerSandboxAdapter';
import { runPythonJudgeExecution } from './sandbox/PythonJudgeExecution';
import { PostgresProblemJudgeConfigRepository } from './sandbox/problemConfig';

export type WorkerRuntimeOptions = {
  pollIntervalMs?: number;
  onTick?: () => Promise<void> | void;
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
};

export type WorkerRuntimeHandle = {
  stop: () => Promise<void>;
};

type WorkerTickDependencies = {
  queue: { claimNext: () => Promise<import('@packages/contracts/src').Judge.JudgeJob | null>; acknowledge: (submissionId: string) => Promise<void> };
  submissions: {
    findById: (id: string) => Promise<{
      id: string;
      ownerUserId: string;
      problemId: string;
      problemVersionId: string;
      language: string;
      sourceCode: string;
      status: SubmissionStatus;
      failureReason?: string;
    } | null>;
    save: (submission: {
      id: string;
      ownerUserId: string;
      problemId: string;
      problemVersionId: string;
      language: string;
      sourceCode: string;
      status: SubmissionStatus;
      failureReason?: string;
    }) => Promise<void>;
  };
  results: {
    findBySubmissionId: (submissionId: string) => Promise<{
      submissionId: string;
      verdict: Verdict;
      timeMs: number;
      memoryKb: number;
    } | null>;
    save: (result: {
      submissionId: string;
      verdict: Verdict;
      timeMs: number;
      memoryKb: number;
    }) => Promise<void>;
  };
  judgeConfigs: {
    findByProblemVersionId: (problemVersionId: string) => Promise<{
      entryFunction: string;
      tests: readonly import('./sandbox/problemConfig').ProblemJudgeTestCase[];
    } | null>;
  };
  sandbox: DockerSandboxAdapter;
  runners: RunnerRegistry;
  image: string;
  logger?: {
    info: (message: string) => void;
  };
};

function toFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  const text = String(error).trim();
  return text.length > 0 ? text : 'Unknown worker execution failure';
}

const DOCKER_RUN_FLAGS_WITH_VALUES = new Set([
  '--cpus',
  '--memory',
  '--network',
  '--security-opt',
  '--pids-limit',
  '--tmpfs'
]);

function resolveDockerRunImage(args: readonly string[]): string {
  if (args[0] !== 'run') {
    throw new Error('Unsupported docker command for worker execution');
  }

  let index = 1;
  while (index < args.length) {
    const current = args[index];
    if (current.startsWith('-')) {
      index += DOCKER_RUN_FLAGS_WITH_VALUES.has(current) ? 2 : 1;
      continue;
    }

    return current;
  }

  throw new Error('Docker image is required for worker execution');
}

async function executeDockerCommand(command: {
  command: string;
  args: readonly string[];
  stdin: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number; timeMs: number; memoryKb: number }> {
  const image = resolveDockerRunImage(command.args);
  const imageIndex = command.args.indexOf(image);
  const prefixArgs = command.args.slice(0, imageIndex);
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(
      command.command,
      [...prefixArgs, image, 'sh', '-lc', 'cat >/tmp/main.py && python /tmp/main.py'],
      {
        stdio: 'pipe'
      }
    );
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timeMs: Math.max(Date.now() - startedAt, 0),
        memoryKb: 0
      });
    });
    child.stdin.write(command.stdin);
    child.stdin.end();
  });
}

export function createLocalWorkerTick(): () => Promise<void> {
  const sqlClient = createLocalPostgresSqlClient();
  const queue = new PostgresJudgeJobQueue(sqlClient);
  const submissions = new PostgresSubmissionRepository(sqlClient);
  const results = new PostgresJudgeResultRepository(sqlClient);
  const judgeConfigs = new PostgresProblemJudgeConfigRepository(sqlClient);
  const sandbox = new DockerSandboxAdapter(executeDockerCommand);
  const runners = new RunnerRegistry([new PythonRunnerPlugin()]);
  const image = process.env.DOCKER_IMAGE_PYTHON ?? 'python:3.12-alpine';

  return createWorkerTick({
    queue,
    submissions,
    results,
    judgeConfigs,
    sandbox,
    runners,
    image,
    logger: console
  });
}

export function createWorkerTick(dependencies: WorkerTickDependencies): () => Promise<void> {
  return async () => {
    const job = await dependencies.queue.claimNext();
    if (!job) {
      return;
    }
    const logger = createWorkerLogger(job.submissionId);
    logger.info('worker.job.claimed', {
      submissionId: job.submissionId,
      ownerUserId: job.ownerUserId,
      problemId: job.problemId
    });

    const submission = await dependencies.submissions.findById(job.submissionId);
    if (!submission) {
      throw new Error(`Submission not found for job ${job.submissionId}`);
    }

    const existingResult = await dependencies.results.findBySubmissionId(job.submissionId);
    if (
      existingResult &&
      (submission.status === 'finished' || submission.status === 'failed')
    ) {
      logger.info('worker.job.duplicate_ignored', {
        submissionId: job.submissionId,
        status: submission.status
      });
      dependencies.logger?.info(
        `worker.job.duplicate_ignored submissionId=${job.submissionId} status=${submission.status}`
      );
      await dependencies.queue.acknowledge(job.submissionId);
      return;
    }

    const judgeConfig = await dependencies.judgeConfigs.findByProblemVersionId(job.problemVersionId);
    if (!judgeConfig) {
      await dependencies.submissions.save({
        ...submission,
        status: 'running' as SubmissionStatus,
        failureReason: undefined
      });
      logger.info('worker.submission.running', {
        submissionId: job.submissionId,
        status: 'running'
      });
      const failureReason = `Judge config not found for problem version ${job.problemVersionId}`;
      await dependencies.submissions.save({
        ...submission,
        status: 'failed' as SubmissionStatus,
        failureReason
      });
      await dependencies.results.save({
        submissionId: job.submissionId,
        verdict: 'CE' as Verdict,
        timeMs: 0,
        memoryKb: 0
      });
      logger.info('worker.submission.completed', {
        submissionId: job.submissionId,
        status: 'failed',
        verdict: 'CE',
        failureReason
      });
      await dependencies.queue.acknowledge(job.submissionId);
      return;
    }

    await dependencies.submissions.save({
      ...submission,
      status: 'running' as SubmissionStatus,
      failureReason: undefined
    });
    logger.info('worker.submission.running', {
      submissionId: job.submissionId,
      status: 'running'
    });

    try {
      const result = await runPythonJudgeExecution({
        sandbox: dependencies.sandbox,
        runners: dependencies.runners,
        image: dependencies.image,
        sourceCode: job.sourceCode,
        entryFunction: judgeConfig.entryFunction,
        tests: judgeConfig.tests
      });

      await dependencies.results.save({
        submissionId: job.submissionId,
        verdict: result.verdict as Verdict,
        timeMs: result.timeMs,
        memoryKb: result.memoryKb
      });
      await dependencies.submissions.save({
        ...submission,
        status: result.status as SubmissionStatus,
        failureReason: undefined
      });
      logger.info('worker.submission.completed', {
        submissionId: job.submissionId,
        status: result.status,
        verdict: result.verdict,
        timeMs: result.timeMs,
        memoryKb: result.memoryKb
      });
      await dependencies.queue.acknowledge(job.submissionId);
    } catch (error) {
      const failureReason = toFailureReason(error);
      logger.error('worker.submission.failed', {
        submissionId: job.submissionId,
        error: failureReason
      });
      await dependencies.submissions.save({
        ...submission,
        status: 'failed' as SubmissionStatus,
        failureReason
      });
      await dependencies.queue.acknowledge(job.submissionId);
    }
  };
}

export function startWorkerRuntime(options?: WorkerRuntimeOptions): WorkerRuntimeHandle {
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  const onTick = options?.onTick ?? (async () => undefined);
  const logger = options?.logger ?? console;

  let stopping = false;
  let runningTick = Promise.resolve();

  logger.info('worker.runtime.started');

  const interval = setInterval(() => {
    if (stopping) {
      return;
    }

    runningTick = Promise.resolve(onTick()).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`worker.runtime.tick_error: ${message}`);
    });
  }, pollIntervalMs);

  return {
    stop: async () => {
      if (stopping) {
        return;
      }
      stopping = true;
      clearInterval(interval);
      await runningTick;
      logger.info('worker.runtime.stopped');
    }
  };
}

export function runWorkerProcess(): void {
  const runtime = startWorkerRuntime({
    onTick: createLocalWorkerTick()
  });

  const shutdown = async () => {
    await runtime.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}

export const __internal__ = {
  resolveDockerRunImage
};
