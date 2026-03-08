import { PublicationState } from '@packages/domain/src/problem';
import { ProblemRepository } from '@packages/domain/src/ports';

export type ManifestProblemAssets = {
  entryFunction: string;
  language: string;
  visibility: 'public' | 'private';
  timeLimitMs: number;
  memoryLimitKb: number;
  starterCode: string;
};

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
  getManifestAssets(versionId: string): Promise<ManifestProblemAssets | null>;
}

export type StudentProblemView = {
  problemId: string;
  title: string;
};

export type StudentProblemDetailView = StudentProblemView & {
  versionId: string;
  statementMarkdown: string;
  entryFunction: string;
  language: string;
  starterCode: string;
  timeLimitMs: number;
  memoryLimitKb: number;
};

export class StudentProblemQueryService {
  constructor(private readonly problems: StudentProblemQueryRepository) {}

  async listPublishedProblems(): Promise<readonly StudentProblemView[]> {
    const problems = await this.problems.listAll();
    const publishedProblems: StudentProblemView[] = [];

    for (const problem of problems) {
      if (problem.latestVersion.publicationState !== PublicationState.PUBLISHED) {
        continue;
      }

      const assets = await this.problems.getManifestAssets(problem.latestVersion.id);
      if (!assets || assets.visibility !== 'public') {
        continue;
      }

      publishedProblems.push({
        problemId: problem.id,
        title: problem.latestVersion.title
      });
    }

    return publishedProblems;
  }

  async getPublishedProblemDetail(problemId: string): Promise<StudentProblemDetailView> {
    const problem = await this.problems.findById(problemId);
    if (!problem || problem.latestVersion.publicationState !== PublicationState.PUBLISHED) {
      throw new Error('Problem not found');
    }

    const assets = await this.problems.getManifestAssets(problem.latestVersion.id);
    if (!assets || assets.visibility !== 'public') {
      throw new Error('Problem not found');
    }

    return {
      problemId: problem.id,
      versionId: problem.latestVersion.id,
      title: problem.latestVersion.title,
      statementMarkdown: problem.latestVersion.statement,
      entryFunction: assets.entryFunction,
      language: assets.language,
      starterCode: assets.starterCode,
      timeLimitMs: assets.timeLimitMs,
      memoryLimitKb: assets.memoryLimitKb
    };
  }
}
