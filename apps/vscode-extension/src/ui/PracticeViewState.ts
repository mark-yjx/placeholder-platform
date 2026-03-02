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

type PendingSubmission = {
  readonly submissionId: string;
};

export function formatSubmissionSummary(result: SubmissionResult): string {
  return `${result.verdict} | ${result.timeMs}ms | ${result.memoryKb}KB`;
}

export function formatSubmissionDetail(result: SubmissionResult): string {
  return `Submission ${result.submissionId}: verdict=${result.verdict}, time=${result.timeMs}ms, memory=${result.memoryKb}KB`;
}

export function formatPendingSubmissionSummary(): string {
  return 'Submitted';
}

export function formatPendingSubmissionDetail(submissionId: string): string {
  return `Submission ${submissionId}: submitted to API`;
}

export class PracticeViewState {
  private problems: readonly PublishedProblem[] = [];
  private readonly pendingSubmissions = new Map<string, PendingSubmission>();
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
    this.pendingSubmissions.delete(result.submissionId);
    this.results.set(result.submissionId, result);
  }

  recordSubmissionCreated(submissionId: string): void {
    if (!submissionId.trim() || this.results.has(submissionId)) {
      return;
    }
    this.pendingSubmissions.set(submissionId, { submissionId });
  }

  getSubmissionNodes(): readonly SubmissionTreeNode[] {
    const pendingNodes = Array.from(this.pendingSubmissions.values()).map((submission) => ({
      id: submission.submissionId,
      label: submission.submissionId,
      description: formatPendingSubmissionSummary(),
      detail: formatPendingSubmissionDetail(submission.submissionId)
    }));
    const resultNodes = Array.from(this.results.values()).map((result) => ({
      id: result.submissionId,
      label: result.submissionId,
      description: formatSubmissionSummary(result),
      detail: formatSubmissionDetail(result)
    }));
    return [...pendingNodes, ...resultNodes];
  }

  getSubmissionDetail(submissionId: string): string | null {
    const pending = this.pendingSubmissions.get(submissionId);
    if (pending) {
      return formatPendingSubmissionDetail(pending.submissionId);
    }
    const result = this.results.get(submissionId);
    return result ? formatSubmissionDetail(result) : null;
  }
}
