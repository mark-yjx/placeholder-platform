import { Problem } from '@packages/domain/src/problem';
import { ProblemCrudRepository } from '@packages/application/src/problem';

export class InMemoryProblemRepository implements ProblemCrudRepository {
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
}
