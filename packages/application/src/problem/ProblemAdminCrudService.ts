import { Role } from '@packages/domain/src/identity';
import { Problem, ProblemVersion } from '@packages/domain/src/problem';
import { ProblemRepository } from '@packages/domain/src/ports';

export interface ProblemCrudRepository extends ProblemRepository {
  deleteById(id: string): Promise<void>;
}

type CreateProblemInput = {
  problemId: string;
  versionId: string;
  title: string;
  statement: string;
};

type UpdateProblemInput = {
  problemId: string;
  versionId: string;
  title?: string;
  statement?: string;
};

export class ProblemAdminCrudService {
  constructor(private readonly problems: ProblemCrudRepository) {}

  async create(input: CreateProblemInput): Promise<Problem> {
    const initialVersion = ProblemVersion.createDraft({
      id: input.versionId,
      versionNumber: 1,
      title: input.title,
      statement: input.statement
    });
    const problem = new Problem(input.problemId, [initialVersion]);
    await this.problems.save(problem);
    return problem;
  }

  async update(input: UpdateProblemInput): Promise<Problem> {
    const problem = await this.problems.findById(input.problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }

    problem.createEditedVersion(input.versionId, {
      title: input.title,
      statement: input.statement
    });
    await this.problems.save(problem);
    return problem;
  }

  async delete(problemId: string): Promise<void> {
    await this.problems.deleteById(problemId);
  }
}

export function isAdmin(roles: readonly Role[]): boolean {
  return roles.includes(Role.ADMIN);
}
