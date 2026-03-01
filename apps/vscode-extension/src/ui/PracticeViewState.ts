import { PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';

export type ProblemTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

export type SubmissionTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
};

export function formatSubmissionSummary(result: SubmissionResult): string {
  return `${result.verdict} | ${result.timeMs}ms | ${result.memoryKb}KB`;
}

export function formatSubmissionDetail(result: SubmissionResult): string {
  return `Submission ${result.submissionId}: verdict=${result.verdict}, time=${result.timeMs}ms, memory=${result.memoryKb}KB`;
}

export class PracticeViewState {
  private problems: readonly PublishedProblem[] = [];
  private readonly results = new Map<string, SubmissionResult>();

  setProblems(problems: readonly PublishedProblem[]): void {
    this.problems = [...problems];
  }

  getProblemNodes(): readonly ProblemTreeNode[] {
    return this.problems.map((problem) => ({
      id: problem.problemId,
      label: problem.title,
      description: problem.problemId
    }));
  }

  recordSubmissionResult(result: SubmissionResult): void {
    this.results.set(result.submissionId, result);
  }

  getSubmissionNodes(): readonly SubmissionTreeNode[] {
    return Array.from(this.results.values()).map((result) => ({
      id: result.submissionId,
      label: result.submissionId,
      description: formatSubmissionSummary(result),
      detail: formatSubmissionDetail(result)
    }));
  }

  getSubmissionDetail(submissionId: string): string | null {
    const result = this.results.get(submissionId);
    return result ? formatSubmissionDetail(result) : null;
  }
}
