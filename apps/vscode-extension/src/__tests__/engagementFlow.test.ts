import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngagementApiClient,
  LeaderboardView,
  ProblemReview,
  ReviewSentiment,
  StudentStatsView
} from '../api/EngagementApiClient';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { EngagementCommands } from '../engagement/EngagementCommands';

class FakeAuthClient implements AuthClient {
  async login(): Promise<{ accessToken: string; email?: string; role?: 'student' | 'admin' }> {
    return { accessToken: 'student-token', email: 'student@example.com', role: 'student' };
  }

  getBrowserAuthUrl(): string {
    return 'http://oj.test/auth/sign-in';
  }

  async exchangeBrowserCode(): Promise<{ accessToken: string; email?: string; role?: 'student' | 'admin' }> {
    return { accessToken: 'student-token', email: 'student@example.com', role: 'student' };
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

  async getMyStats(_accessToken: string): Promise<StudentStatsView> {
    return {
      userId: 'student-1',
      displayName: 'Student One',
      solvedCount: 3,
      solvedByDifficulty: [
        { key: 'easy', count: 1 },
        { key: 'medium', count: 1 },
        { key: 'hard', count: 1 }
      ],
      submissionCount: 6,
      acceptedCount: 4,
      acceptanceRate: 66.7,
      activeDays: 6,
      currentStreak: 2,
      longestStreak: 4,
      languageBreakdown: [{ key: 'python', count: 6 }],
      tagBreakdown: [
        { key: 'array', count: 1 },
        { key: 'graphs', count: 1 }
      ],
      badges: [
        {
          id: 'first_ac',
          title: 'First AC',
          description: 'Earn your first accepted submission.',
          earned: true
        }
      ]
    };
  }

  async getLeaderboard(_accessToken: string, scope: 'all-time'): Promise<LeaderboardView> {
    return {
      scope,
      title: 'All-Time Leaderboard',
      formula: 'Ranked by solvedCount desc, acceptedCount desc, submissionCount asc.',
      generatedAt: '2026-03-10T13:00:00.000Z',
      entries: [
        {
          rank: 1,
          userId: 'student-1',
          displayName: 'Student One',
          solvedCount: 3,
          acceptedCount: 4,
          submissionCount: 6,
          currentStreak: 2,
          longestStreak: 4,
          score: 3,
          scoreLabel: 'Solved'
        },
        {
          rank: 2,
          userId: 'student-2',
          displayName: 'Student Two',
          solvedCount: 2,
          acceptedCount: 2,
          submissionCount: 3,
          currentStreak: 1,
          longestStreak: 2,
          score: 2,
          scoreLabel: 'Solved'
        }
      ]
    };
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
  assert.equal(stats, 'solved=3, accepted=4/6, rate=66.7%, streak=2/4');

  const ranking = await engagementCommands.showPublicRanking();
  assert.deepEqual(ranking, [
    '#1 Student One solved=3 accepted=4 submissions=6',
    '#2 Student Two solved=2 accepted=2 submissions=3'
  ]);
});
