import {
  CreateSubmissionRequest,
  ProblemDetail,
  PracticeApiClient,
  PublishedProblem,
  SubmissionResult
} from '../api/PracticeApiClient';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { runProtectedCommand } from '../commands/ProtectedCommands';

export class PracticeCommands {
  constructor(
    private readonly client: PracticeApiClient,
    private readonly tokenStore: SessionTokenStore
  ) {}

  async fetchPublishedProblems(): Promise<readonly PublishedProblem[]> {
    return runProtectedCommand(this.tokenStore, async () =>
      this.client.listPublishedProblems(this.requireAccessToken())
    );
  }

  async listSubmissions(): Promise<readonly SubmissionResult[]> {
    return runProtectedCommand(this.tokenStore, async () =>
      this.client.listSubmissions(this.requireAccessToken())
    );
  }

  async fetchProblemDetail(problemId: string): Promise<ProblemDetail> {
    if (!problemId.trim()) {
      throw new Error('Problem id is required');
    }

    return runProtectedCommand(this.tokenStore, async () =>
      this.client.getPublishedProblemDetail(this.requireAccessToken(), problemId)
    );
  }

  async submitCode(request: CreateSubmissionRequest): Promise<{ submissionId: string }> {
    if (request.language !== 'python') {
      throw new Error('Only python is supported');
    }

    if (!request.sourceCode.trim()) {
      throw new Error('Source code is required');
    }

    return runProtectedCommand(this.tokenStore, async () =>
      this.client.createSubmission(this.requireAccessToken(), request)
    );
  }

  async pollSubmissionResult(submissionId: string): Promise<SubmissionResult> {
    if (!submissionId.trim()) {
      throw new Error('Submission id is required');
    }

    return runProtectedCommand(this.tokenStore, async () =>
      this.client.getSubmissionResult(this.requireAccessToken(), submissionId)
    );
  }

  async viewSubmissionResult(submissionId: string): Promise<string> {
    const result = await this.pollSubmissionResult(submissionId);
    return formatSubmissionResult(result);
  }

  private requireAccessToken(): string {
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return token;
  }
}

export function formatSubmissionResult(result: SubmissionResult): string {
  if (result.status === 'queued' || result.status === 'running') {
    return `${result.status.toUpperCase()} | waiting for judge result`;
  }

  const failureSnippet = result.failureReason?.trim()
    ? ` | ${result.failureReason.trim()}`
    : '';

  if (result.status === 'failed' && result.failureReason?.trim()) {
    return `FAILED | ${result.failureReason.trim()}`;
  }

  if (result.status === 'failed') {
    return 'FAILED | no failure reason available';
  }

  if (result.verdict !== undefined && result.timeMs !== undefined && result.memoryKb !== undefined) {
    if (result.verdict === 'CE') {
      return `COMPILE ERROR (CE) | time: ${result.timeMs}ms | memory: ${result.memoryKb}KB${failureSnippet}`;
    }

    if (result.verdict === 'RE') {
      return `RUNTIME ERROR (RE) | time: ${result.timeMs}ms | memory: ${result.memoryKb}KB${failureSnippet}`;
    }

    if (result.verdict === 'TLE') {
      return `TIME LIMIT EXCEEDED (TLE) | time: ${result.timeMs}ms | memory: ${result.memoryKb}KB${failureSnippet}`;
    }

    return `${result.verdict} | time: ${result.timeMs}ms | memory: ${result.memoryKb}KB${failureSnippet}`;
  }

  if (result.verdict === 'CE') {
    return `COMPILE ERROR (CE)${failureSnippet}`;
  }

  if (result.verdict === 'RE') {
    return `RUNTIME ERROR (RE)${failureSnippet}`;
  }

  if (result.verdict === 'TLE') {
    return `TIME LIMIT EXCEEDED (TLE)${failureSnippet}`;
  }

  if (result.verdict !== undefined) {
    return `${result.verdict} | no performance metrics reported${failureSnippet}`;
  }

  return `${result.status.toUpperCase()} | no result details available`;
}
