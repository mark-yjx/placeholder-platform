import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngagementApiClient,
  ProblemReview,
  PublicRankingEntry,
  PublicStatsView,
  ReviewSentiment
} from '../api/EngagementApiClient';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { EngagementCommands } from '../engagement/EngagementCommands';

class FakeAuthClient implements AuthClient {
  async login(): Promise<{ accessToken: string }> {
    return { accessToken: 'student-token' };
  }
}

class FakeEngagementApiClient implements EngagementApiClient {
  private readonly favorites = new Set<string>();
  private readonly reviewsByProblem = new Map<string, ProblemReview[]>();
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
    request: { problemId: string; content: string; sentiment: ReviewSentiment }
  ): Promise<ProblemReview> {
    this.reviewCounter += 1;
    const created: ProblemReview = {
      reviewId: `review-${this.reviewCounter}`,
      problemId: request.problemId,
      content: request.content,
      sentiment: request.sentiment
    };
    const current = this.reviewsByProblem.get(request.problemId) ?? [];
    current.push(created);
    this.reviewsByProblem.set(request.problemId, current);
    return created;
  }

  async listReviews(_accessToken: string, problemId: string): Promise<readonly ProblemReview[]> {
    return this.reviewsByProblem.get(problemId) ?? [];
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
      { userId: 'student-a', compositeScore: 1_999_800, solvedCount: 2, totalAcceptedTimeMs: 200 },
      { userId: 'student-b', compositeScore: 999_850, solvedCount: 1, totalAcceptedTimeMs: 150 }
    ];
  }
}

test('favorite and review actions persist and stats/ranking views display api data', async () => {
  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new FakeAuthClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new FakeEngagementApiClient(), tokenStore);

  await authCommands.login({ email: 'student@example.com', password: 'secret' });

  const favoritesAfterAdd = await engagementCommands.favoriteProblem('p1');
  assert.deepEqual(favoritesAfterAdd, ['p1']);

  const favoritesAfterRemove = await engagementCommands.unfavoriteProblem('p1');
  assert.deepEqual(favoritesAfterRemove, []);

  const reviews = await engagementCommands.submitReview({
    problemId: 'p1',
    content: 'Useful problem',
    sentiment: 'like'
  });
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.sentiment, 'like');

  const stats = await engagementCommands.showPublicStats();
  assert.equal(stats, 'judged=12, accepted=9, rate=75%');

  const ranking = await engagementCommands.showPublicRanking();
  assert.deepEqual(ranking, [
    '#1 student-a score=1999800 solved=2 acceptedTimeMs=200',
    '#2 student-b score=999850 solved=1 acceptedTimeMs=150'
  ]);
});
