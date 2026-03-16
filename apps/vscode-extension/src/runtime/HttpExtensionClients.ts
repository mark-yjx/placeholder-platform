import { randomUUID } from 'node:crypto';
import {
  EngagementApiClient,
  LeaderboardScope,
  LeaderboardView,
  ProblemReview,
  StudentStatsView
} from '../api/EngagementApiClient';
import {
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  ProblemDetail,
  PracticeApiClient,
  PublishedProblem,
  SubmissionResult
} from '../api/PracticeApiClient';
import { AuthClient, BrowserAuthMode, BrowserAuthUrlInput, LoginRequest, LoginResponse } from '../auth/AuthClient';
import { ApiErrorPayload, ExtensionApiError } from '../errors/ExtensionErrorMapper';

export type ExtensionApiClientConfig = {
  apiBaseUrl: string;
  requestTimeoutMs: number;
};

type RequestJsonOptions = {
  method?: string;
  accessToken?: string;
  body?: unknown;
};

async function parseApiErrorPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }

  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return undefined;
  }
}

async function requestJson<T>(
  config: ExtensionApiClientConfig,
  path: string,
  options: RequestJsonOptions = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const requestUrl = `${config.apiBaseUrl}${path}`;
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (options.accessToken) {
    headers.set('authorization', `Bearer ${options.accessToken}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
    ) {
      throw Object.assign(
        new Error(`Request timed out after ${config.requestTimeoutMs}ms. Check oj.requestTimeoutMs and try again.`),
        { code: 'ETIMEDOUT', requestMethod: method, requestUrl }
      );
    }
    if (error instanceof Error) {
      throw Object.assign(error, { requestMethod: method, requestUrl });
    }
    throw Object.assign(new Error(String(error)), { requestMethod: method, requestUrl });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ExtensionApiError(response.status, await parseApiErrorPayload(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export class HttpAuthClient implements AuthClient {
  constructor(private readonly config: ExtensionApiClientConfig) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    return requestJson<LoginResponse>(this.config, '/auth/login', {
      method: 'POST',
      body: request
    });
  }

  getBrowserAuthUrl(mode: BrowserAuthMode, input?: BrowserAuthUrlInput): string {
    const url = new URL(`${this.config.apiBaseUrl}${mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}`);
    if (input?.callbackUri) {
      url.searchParams.set('callback_uri', input.callbackUri);
    }
    if (input?.state) {
      url.searchParams.set('oj_state', input.state);
    }
    return url.toString();
  }

  async exchangeBrowserCode(input: { code: string }): Promise<LoginResponse> {
    return requestJson<LoginResponse>(this.config, '/auth/extension/exchange', {
      method: 'POST',
      body: input
    });
  }
}

export class HttpPracticeApiClient implements PracticeApiClient {
  constructor(private readonly config: ExtensionApiClientConfig) {}

  async listPublishedProblems(accessToken: string): Promise<readonly PublishedProblem[]> {
    const response = await requestJson<{ problems: readonly PublishedProblem[] }>(this.config, '/problems', {
      accessToken
    });
    return response.problems;
  }

  async getPublishedProblemDetail(accessToken: string, problemId: string): Promise<ProblemDetail> {
    return requestJson<ProblemDetail>(this.config, `/problems/${problemId}`, {
      accessToken
    });
  }

  async listSubmissions(accessToken: string): Promise<readonly SubmissionResult[]> {
    const response = await requestJson<{
      submissions: readonly SubmissionResult[];
    }>(this.config, '/submissions', {
      accessToken
    });
    return response.submissions;
  }

  async createSubmission(
    accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<CreateSubmissionResponse> {
    const response = await requestJson<CreateSubmissionResponse>(this.config, '/submissions', {
      method: 'POST',
      accessToken,
      body: {
        submissionId: randomUUID(),
        ...request
      }
    });
    return { submissionId: response.submissionId };
  }

  async getSubmissionResult(accessToken: string, submissionId: string): Promise<SubmissionResult> {
    const response = await requestJson<{
      submissionId: string;
      status: SubmissionResult['status'];
      submittedAt?: string;
      failureReason?: string;
      verdict?: SubmissionResult['verdict'];
      timeMs?: number;
      memoryKb?: number;
    }>(this.config, `/submissions/${submissionId}`, {
      accessToken
    });

    const result: SubmissionResult = {
      submissionId: response.submissionId,
      status: response.status,
      verdict: response.verdict,
      timeMs: response.timeMs,
      memoryKb: response.memoryKb
    };

    if (response.failureReason !== undefined) {
      result.failureReason = response.failureReason;
    }

    if (response.submittedAt !== undefined) {
      result.submittedAt = response.submittedAt;
    }

    return result;
  }
}

export class HttpEngagementApiClient implements EngagementApiClient {
  constructor(private readonly config: ExtensionApiClientConfig) {}

  async addFavorite(accessToken: string, problemId: string): Promise<void> {
    await requestJson<{ ok: true }>(this.config, `/favorites/${problemId}`, {
      method: 'PUT',
      accessToken
    });
  }

  async removeFavorite(accessToken: string, problemId: string): Promise<void> {
    await requestJson<{ ok: true }>(this.config, `/favorites/${problemId}`, {
      method: 'DELETE',
      accessToken
    });
  }

  async listFavorites(accessToken: string): Promise<readonly string[]> {
    const response = await requestJson<{ favorites: readonly string[] }>(this.config, '/favorites', {
      accessToken
    });
    return response.favorites;
  }

  async createReview(
    accessToken: string,
    request: { problemId: string; content: string; sentiment: 'like' | 'dislike' }
  ): Promise<ProblemReview> {
    await requestJson<{ ok: true }>(this.config, `/reviews/${request.problemId}`, {
      method: 'PUT',
      accessToken,
      body: {
        content: request.content,
        sentiment: request.sentiment
      }
    });

    return {
      reviewId: `${request.problemId}:${request.sentiment}:${request.content}`,
      problemId: request.problemId,
      content: request.content,
      sentiment: request.sentiment
    };
  }

  async listReviews(accessToken: string, problemId: string): Promise<readonly ProblemReview[]> {
    const response = await requestJson<{
      reviews: readonly {
        userId?: string;
        reviewId?: string;
        problemId: string;
        content: string;
        sentiment: 'like' | 'dislike';
        createdAt?: string;
      }[];
    }>(this.config, `/reviews/${problemId}`, {
      accessToken
    });

    return response.reviews.map((review, index) => ({
      reviewId: review.reviewId ?? `${review.problemId}:${review.userId ?? 'anonymous'}:${review.createdAt ?? index}`,
      problemId: review.problemId,
      content: review.content,
      sentiment: review.sentiment
    }));
  }

  async getMyStats(accessToken: string): Promise<StudentStatsView> {
    return requestJson<StudentStatsView>(this.config, '/me/stats', {
      accessToken
    });
  }

  async getLeaderboard(accessToken: string, scope: LeaderboardScope): Promise<LeaderboardView> {
    return requestJson<LeaderboardView>(this.config, `/leaderboards/${scope}`, {
      accessToken
    });
  }
}
