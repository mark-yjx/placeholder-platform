import { Judge } from '@placeholder/contracts/src';
import { createWorkerLogger } from './observability/WorkerLogger';
import { RunnerRegistry } from './runner';
import { ExecutionPlanner } from './sandbox/ExecutionPlanner';

export function consumeJudgeJob(job: Judge.JudgeJob): Judge.JudgeJob {
  Judge.validateJudgeJob(job);
  createWorkerLogger(job.submissionId).info('worker.job.received', {
    submissionId: job.submissionId,
    ownerUserId: job.ownerUserId,
    problemId: job.problemId
  });
  return job;
}

export async function planJudgeExecution(
  planner: ExecutionPlanner,
  job: Judge.JudgeJob
): Promise<{ problemId: string; limits: { cpuCores: number; memoryMb: number; timeMs: number } }> {
  Judge.validateJudgeJob(job);
  const plan = await planner.plan(job);
  return {
    problemId: plan.job.problemId,
    limits: plan.limits
  };
}

export function resolveRunnerForJob(
  registry: RunnerRegistry,
  job: Judge.JudgeJob
): { language: string; runArgs: readonly string[] } {
  Judge.validateJudgeJob(job);
  return registry.resolve(job.language).resolve();
}
