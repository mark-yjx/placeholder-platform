import { Judge } from '@packages/contracts/src';
import { ExecutionPlanner } from './sandbox/ExecutionPlanner';

export function consumeJudgeJob(job: Judge.JudgeJob): Judge.JudgeJob {
  Judge.validateJudgeJob(job);
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
