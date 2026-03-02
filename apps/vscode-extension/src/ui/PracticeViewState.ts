import { PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';

export type ProblemTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
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

function isTerminalStatus(status: SubmissionResult['status']): boolean {
  return status === 'finished' || status === 'failed';
}

export function formatSubmissionSummary(result: SubmissionResult): string {
  if (result.status === 'queued' || result.status === 'running') {
    return result.status;
  }

  if (result.verdict !== undefined && result.timeMs !== undefined && result.memoryKb !== undefined) {
    return `${result.verdict} | ${result.timeMs}ms | ${result.memoryKb}KB`;
  }

  return result.status;
}

export function formatSubmissionDetail(result: SubmissionResult): string {
  if (result.status === 'queued' || result.status === 'running') {
    return `Submission ${result.submissionId}: status=${result.status}`;
  }

  if (result.verdict !== undefined && result.timeMs !== undefined && result.memoryKb !== undefined) {
    return `Submission ${result.submissionId}: verdict=${result.verdict}, time=${result.timeMs}ms, memory=${result.memoryKb}KB`;
  }

  return `Submission ${result.submissionId}: status=${result.status}`;
}

export function formatPendingSubmissionSummary(): string {
  return 'Submitted';
}

export function formatPendingSubmissionDetail(submissionId: string): string {
  return `Submission ${submissionId}: submitted to API`;
}

export class PracticeViewState {
  private problems: readonly PublishedProblem[] = [];
  private selectedProblemId: string | null = null;
  private readonly pendingSubmissions = new Map<string, PendingSubmission>();
  private readonly results = new Map<string, SubmissionResult>();

  setProblems(problems: readonly PublishedProblem[]): void {
    this.problems = [...problems];
    if (
      this.selectedProblemId &&
      !this.problems.some((problem) => problem.problemId === this.selectedProblemId)
    ) {
      this.selectedProblemId = null;
    }
  }

  setSelectedProblem(problemId: string): void {
    if (!problemId.trim()) {
      return;
    }

    const exists = this.problems.some((problem) => problem.problemId === problemId);
    if (exists) {
      this.selectedProblemId = problemId;
    }
  }

  getSelectedProblemId(): string | null {
    return this.selectedProblemId;
  }

  getProblemNodes(): readonly ProblemTreeNode[] {
    return this.problems.map((problem) => ({
      id: problem.problemId,
      label: problem.title,
      description: problem.problemId,
      detail: formatProblemDetail(problem)
    }));
  }

  getProblemDetail(problemId: string): string | null {
    const problem = this.problems.find((candidate) => candidate.problemId === problemId);
    return problem ? formatProblemDetail(problem) : null;
  }

  recordSubmissionResult(result: SubmissionResult): void {
    const existing = this.results.get(result.submissionId);
    if (existing && isTerminalStatus(existing.status)) {
      return;
    }
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

export function formatProblemDetail(problem: PublishedProblem): string {
  const statement = typeof problem.statement === 'string' && problem.statement.trim().length > 0
    ? problem.statement.trim()
    : 'No statement available.';
  return `# ${problem.title}

- Problem ID: ${problem.problemId}

## Statement

${statement}
`;
}
