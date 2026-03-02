import { PublicationState } from '@packages/domain/src/problem';
import { ProblemRepository } from '@packages/domain/src/ports';

export interface StudentProblemQueryRepository extends ProblemRepository {
  listAll(): Promise<readonly {
    id: string;
    latestVersion: {
      id: string;
      title: string;
      statement: string;
      publicationState: PublicationState;
    };
  }[]>;
  getStarterCode(versionId: string): Promise<string | null>;
}

export type StudentProblemView = {
  problemId: string;
  versionId: string;
  title: string;
  statement: string;
};

export type StudentProblemDetailView = StudentProblemView & {
  starterCode?: string;
};

export class StudentProblemQueryService {
  constructor(private readonly problems: StudentProblemQueryRepository) {}

  async listPublishedProblems(): Promise<readonly StudentProblemView[]> {
    const problems = await this.problems.listAll();
    return problems
      .filter((problem) => problem.latestVersion.publicationState === PublicationState.PUBLISHED)
      .map((problem) => ({
        problemId: problem.id,
        versionId: problem.latestVersion.id,
        title: problem.latestVersion.title,
        statement: problem.latestVersion.statement
      }));
  }

  async getPublishedProblemDetail(problemId: string): Promise<StudentProblemDetailView> {
    const problem = await this.problems.findById(problemId);
    if (!problem || problem.latestVersion.publicationState !== PublicationState.PUBLISHED) {
      throw new Error('Problem not found');
    }
    const starterCode = await this.problems.getStarterCode(problem.latestVersion.id);
    return {
      problemId: problem.id,
      versionId: problem.latestVersion.id,
      title: problem.latestVersion.title,
      statement: problem.latestVersion.statement,
      ...(starterCode ? { starterCode } : {})
    };
  }
}
