import { Problem } from '@packages/domain/src/problem';
import { ProblemRepository } from '@packages/domain/src/ports';

export interface ProblemPublicationRepository extends ProblemRepository {}

export class ProblemPublicationService {
  constructor(private readonly problems: ProblemPublicationRepository) {}

  async publish(problemId: string): Promise<Problem> {
    const problem = await this.problems.findById(problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }
    problem.publishLatestVersion();
    await this.problems.save(problem);
    return problem;
  }

  async unpublish(problemId: string): Promise<Problem> {
    const problem = await this.problems.findById(problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }
    problem.unpublishLatestVersion();
    await this.problems.save(problem);
    return problem;
  }
}
