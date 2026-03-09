import { ProblemVersionTimelineEntry } from '@packages/application/src/problem';
import { Problem } from '@packages/domain/src/problem';
import { ProblemCrudRepository, ProblemVersionHistoryRepository } from '@packages/application/src/problem';

export class InMemoryProblemRepository
  implements ProblemCrudRepository, ProblemVersionHistoryRepository
{
  private readonly problems = new Map<string, Problem>();

  async findById(id: string): Promise<Problem | null> {
    return this.problems.get(id) ?? null;
  }

  async save(problem: Problem): Promise<void> {
    this.problems.set(problem.id, problem);
  }

  async deleteById(id: string): Promise<void> {
    this.problems.delete(id);
  }

  async listAll(): Promise<readonly Problem[]> {
    return Array.from(this.problems.values());
  }

  async findVersionTimeline(problemId: string): Promise<readonly ProblemVersionTimelineEntry[]> {
    const problem = this.problems.get(problemId);
    if (!problem) {
      return [];
    }
    return problem.versions.map((version) => ({
      versionId: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      publicationState: version.publicationState
    }));
  }

  async getManifestAssets(
    _versionId: string
  ): Promise<{
    entryFunction: string;
    language: string;
    visibility: 'public' | 'private';
    timeLimitMs: number;
    memoryLimitKb: number;
    starterCode: string;
    examples: readonly {
      input: unknown;
      output: unknown;
    }[];
    publicTests: readonly {
      input: unknown;
      output: unknown;
    }[];
  } | null> {
    return null;
  }
}
