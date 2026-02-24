import { ResourceLimits } from './judgePolicy';

export interface ProblemExecutionConfigRepository {
  findLimitsByProblemId(problemId: string): Promise<Partial<ResourceLimits> | null>;
}

export class InMemoryProblemExecutionConfigRepository implements ProblemExecutionConfigRepository {
  private readonly overridesByProblemId = new Map<string, Partial<ResourceLimits>>();

  setOverride(problemId: string, limits: Partial<ResourceLimits>): void {
    this.overridesByProblemId.set(problemId, { ...limits });
  }

  async findLimitsByProblemId(problemId: string): Promise<Partial<ResourceLimits> | null> {
    return this.overridesByProblemId.get(problemId) ?? null;
  }
}
