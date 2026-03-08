import { ProblemDetail, PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';

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

function formatVerdictSummary(verdict: NonNullable<SubmissionResult['verdict']>): string {
  if (verdict === 'CE') {
    return 'Compile Error (CE)';
  }

  if (verdict === 'RE') {
    return 'Runtime Error (RE)';
  }

  if (verdict === 'TLE') {
    return 'Time Limit Exceeded (TLE)';
  }

  return verdict;
}

function formatVerdictDetail(verdict: NonNullable<SubmissionResult['verdict']>): string {
  if (verdict === 'CE') {
    return 'finished with compile error (CE)';
  }

  if (verdict === 'RE') {
    return 'finished with runtime error (RE)';
  }

  if (verdict === 'TLE') {
    return 'finished with time limit exceeded (TLE)';
  }

  return `verdict=${verdict}`;
}

function formatFailureSnippet(result: SubmissionResult): string {
  const snippet = result.failureReason?.trim();
  return snippet ? ` | ${snippet}` : '';
}

export function formatSubmissionSummary(result: SubmissionResult): string {
  if (result.status === 'queued' || result.status === 'running') {
    return result.status;
  }

  if (result.verdict !== undefined && result.timeMs !== undefined && result.memoryKb !== undefined) {
    return `${formatVerdictSummary(result.verdict)} | ${result.timeMs}ms | ${result.memoryKb}KB${formatFailureSnippet(result)}`;
  }

  if (result.status === 'failed' && result.failureReason?.trim()) {
    return `failed | ${result.failureReason.trim()}`;
  }

  return result.status;
}

export function formatSubmissionDetail(result: SubmissionResult): string {
  if (result.status === 'queued' || result.status === 'running') {
    return `Submission ${result.submissionId}: status=${result.status}`;
  }

  if (result.status === 'failed') {
    const failureReason = result.failureReason?.trim();
    return failureReason
      ? `Submission ${result.submissionId}: failed - ${failureReason}`
      : `Submission ${result.submissionId}: failed - no failure reason available`;
  }

  if (result.verdict !== undefined && result.timeMs !== undefined && result.memoryKb !== undefined) {
    return `Submission ${result.submissionId}: ${formatVerdictDetail(result.verdict)}, time=${result.timeMs}ms, memory=${result.memoryKb}KB${formatFailureSnippet(result)}`;
  }

  if (result.verdict !== undefined) {
    return `Submission ${result.submissionId}: ${formatVerdictDetail(result.verdict)}${formatFailureSnippet(result)}`;
  }

  return `Submission ${result.submissionId}: status=${result.status}`;
}

export function formatPendingSubmissionSummary(): string {
  return 'Submitted';
}

export function formatPendingSubmissionDetail(submissionId: string): string {
  return `Submission ${submissionId}: submitted to API`;
}

export function formatSubmissionLabel(submissionId: string, summary: string): string {
  return `${submissionId} | ${summary}`;
}

export class PracticeViewState {
  private problems: readonly PublishedProblem[] = [];
  private selectedProblemId: string | null = null;
  private readonly pendingSubmissions = new Map<string, PendingSubmission>();
  private readonly results = new Map<string, SubmissionResult>();

  setProblems(problems: readonly PublishedProblem[]): void {
    const existingById = new Map(this.problems.map((problem) => [problem.problemId, problem]));
    this.problems = problems.map((problem) => ({
      ...existingById.get(problem.problemId),
      ...problem
    }));
    if (
      this.selectedProblemId &&
      !this.problems.some((problem) => problem.problemId === this.selectedProblemId)
    ) {
      this.selectedProblemId = null;
    }
  }

  showProblemDetail(problem: ProblemDetail): void {
    const existing = this.problems.find((candidate) => candidate.problemId === problem.problemId);
    const merged: PublishedProblem = {
      ...existing,
      ...problem
    };
    if (existing) {
      this.problems = this.problems.map((candidate) =>
        candidate.problemId === problem.problemId ? merged : candidate
      );
      return;
    }

    this.problems = [...this.problems, merged];
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
      label: formatSubmissionLabel(submission.submissionId, formatPendingSubmissionSummary()),
      description: formatPendingSubmissionSummary(),
      detail: formatPendingSubmissionDetail(submission.submissionId)
    }));
    const resultNodes = Array.from(this.results.values()).map((result) => ({
      id: result.submissionId,
      label: formatSubmissionLabel(result.submissionId, formatSubmissionSummary(result)),
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
  const statement = resolveProblemStatementMarkdown(problem);
  const statementBody = statement
    ? statement
    : 'No statement available.';
  return `# ${problem.title}

- Problem ID: ${problem.problemId}

## Statement

${statementBody}
`;
}

export function resolveProblemStatementMarkdown(problem: {
  statementMarkdown?: string;
  statement?: string;
}): string | null {
  if (typeof problem.statementMarkdown === 'string' && problem.statementMarkdown.trim().length > 0) {
    return problem.statementMarkdown.trim();
  }

  if (typeof problem.statement === 'string' && problem.statement.trim().length > 0) {
    return problem.statement.trim();
  }

  return null;
}
