import type { Judge } from '@packages/contracts/src';
import { DEFAULT_RESOURCE_LIMITS, ResourceLimits } from './judgePolicy';
import { ProblemExecutionConfigRepository } from './problemConfig';

export type ExecutionPlan = {
  job: Judge.JudgeJob;
  limits: ResourceLimits;
};

export class ExecutionPlanner {
  constructor(private readonly problemConfig: ProblemExecutionConfigRepository) {}

  async plan(job: Judge.JudgeJob): Promise<ExecutionPlan> {
    const override = await this.problemConfig.findLimitsByProblemId(job.problemId);
    const limits: ResourceLimits = {
      cpuCores: override?.cpuCores ?? DEFAULT_RESOURCE_LIMITS.cpuCores,
      memoryMb: override?.memoryMb ?? DEFAULT_RESOURCE_LIMITS.memoryMb,
      timeMs: override?.timeMs ?? DEFAULT_RESOURCE_LIMITS.timeMs
    };

    return { job, limits };
  }
}
