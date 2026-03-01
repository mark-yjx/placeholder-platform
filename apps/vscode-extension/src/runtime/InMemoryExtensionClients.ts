import { EngagementApiClient, ProblemReview, PublicRankingEntry, PublicStatsView } from '../api/EngagementApiClient';
import { AuthClient, LoginRequest, LoginResponse } from '../auth/AuthClient';
import {
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  PracticeApiClient,
  PublishedProblem,
  SubmissionResult
} from '../api/PracticeApiClient';

export type ExtensionApiClientConfig = {
  apiBaseUrl: string;
};

export class InMemoryAuthClient implements AuthClient {
  constructor(readonly config: ExtensionApiClientConfig = { apiBaseUrl: 'http://localhost:3000' }) {}

  async login(_request: LoginRequest): Promise<LoginResponse> {
    return { accessToken: 'dev-student-token' };
  }
}

export class InMemoryPracticeApiClient implements PracticeApiClient {
  constructor(readonly config: ExtensionApiClientConfig = { apiBaseUrl: 'http://localhost:3000' }) {}

  private readonly problems: readonly PublishedProblem[] = [
    { problemId: 'problem-1', title: 'Two Sum' },
    { problemId: 'problem-2', title: 'FizzBuzz' }
  ];

  private counter = 0;
  private readonly results = new Map<string, SubmissionResult>();

  async listPublishedProblems(_accessToken: string): Promise<readonly PublishedProblem[]> {
    return this.problems;
  }

  async createSubmission(
    _accessToken: string,
    request: CreateSubmissionRequest
  ): Promise<CreateSubmissionResponse> {
    this.counter += 1;
    const submissionId = `submission-${this.counter}`;
    this.results.set(submissionId, {
      submissionId,
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    });

    void request;
    return { submissionId };
  }

  async getSubmissionResult(_accessToken: string, submissionId: string): Promise<SubmissionResult> {
    const result = this.results.get(submissionId);
    if (!result) {
      throw new Error('Submission not found');
    }
    return result;
  }
}

export class InMemoryEngagementApiClient implements EngagementApiClient {
  constructor(readonly config: ExtensionApiClientConfig = { apiBaseUrl: 'http://localhost:3000' }) {}

  private readonly favorites = new Set<string>();
  private readonly reviews = new Map<string, ProblemReview[]>();
  private reviewCounter = 0;

  async addFavorite(_accessToken: string, problemId: string): Promise<void> {
    this.favorites.add(problemId);
  }

  async removeFavorite(_accessToken: string, problemId: string): Promise<void> {
    this.favorites.delete(problemId);
  }

  async listFavorites(_accessToken: string): Promise<readonly string[]> {
    return Array.from(this.favorites.values()).sort();
  }

  async createReview(
    _accessToken: string,
    request: { problemId: string; content: string; sentiment: 'like' | 'dislike' }
  ): Promise<ProblemReview> {
    this.reviewCounter += 1;
    const review: ProblemReview = {
      reviewId: `review-${this.reviewCounter}`,
      problemId: request.problemId,
      content: request.content,
      sentiment: request.sentiment
    };
    const current = this.reviews.get(request.problemId) ?? [];
    current.push(review);
    this.reviews.set(request.problemId, current);
    return review;
  }

  async listReviews(_accessToken: string, problemId: string): Promise<readonly ProblemReview[]> {
    return this.reviews.get(problemId) ?? [];
  }

  async getPublicStats(_accessToken: string): Promise<PublicStatsView> {
    return {
      totalJudgedSubmissions: 12,
      totalAcceptedSubmissions: 9,
      acceptanceRatePercent: 75
    };
  }

  async getPublicRanking(_accessToken: string): Promise<readonly PublicRankingEntry[]> {
    return [
      {
        userId: 'student-a',
        compositeScore: 1_999_800,
        solvedCount: 2,
        totalAcceptedTimeMs: 200
      }
    ];
  }
}
