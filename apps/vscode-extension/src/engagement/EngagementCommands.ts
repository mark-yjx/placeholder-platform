import {
  EngagementApiClient,
  LeaderboardEntryView,
  LeaderboardScope,
  LeaderboardView,
  ProblemReview,
  ReviewSentiment,
  StudentStatsView
} from '../api/EngagementApiClient';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { runProtectedCommand } from '../commands/ProtectedCommands';

export class EngagementCommands {
  constructor(
    private readonly apiClient: EngagementApiClient,
    private readonly tokenStore: SessionTokenStore
  ) {}

  async favoriteProblem(problemId: string): Promise<readonly string[]> {
    return runProtectedCommand(this.tokenStore, async () => {
      await this.apiClient.addFavorite(this.requireAccessToken(), problemId);
      return this.apiClient.listFavorites(this.requireAccessToken());
    });
  }

  async unfavoriteProblem(problemId: string): Promise<readonly string[]> {
    return runProtectedCommand(this.tokenStore, async () => {
      await this.apiClient.removeFavorite(this.requireAccessToken(), problemId);
      return this.apiClient.listFavorites(this.requireAccessToken());
    });
  }

  async submitReview(request: {
    problemId: string;
    content: string;
    sentiment: ReviewSentiment;
  }): Promise<readonly ProblemReview[]> {
    if (!request.content.trim()) {
      throw new Error('Review content is required');
    }

    return runProtectedCommand(this.tokenStore, async () => {
      await this.apiClient.createReview(this.requireAccessToken(), request);
      return this.apiClient.listReviews(this.requireAccessToken(), request.problemId);
    });
  }

  async getMyStats(): Promise<StudentStatsView> {
    return runProtectedCommand(this.tokenStore, async () =>
      this.apiClient.getMyStats(this.requireAccessToken())
    );
  }

  async getLeaderboard(scope: LeaderboardScope): Promise<LeaderboardView> {
    return runProtectedCommand(this.tokenStore, async () =>
      this.apiClient.getLeaderboard(this.requireAccessToken(), scope)
    );
  }

  async showPublicStats(): Promise<string> {
    return formatStats(await this.getMyStats());
  }

  async showPublicRanking(): Promise<readonly string[]> {
    const ranking = await this.getLeaderboard('all-time');
    return ranking.entries.map((entry) => formatRankingEntry(entry));
  }

  private requireAccessToken(): string {
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return token;
  }
}

export function formatStats(stats: StudentStatsView): string {
  return `solved=${stats.solvedCount}, accepted=${stats.acceptedCount}/${stats.submissionCount}, rate=${stats.acceptanceRate}%, streak=${stats.currentStreak}/${stats.longestStreak}`;
}

export function formatRankingEntry(entry: LeaderboardEntryView): string {
  const scoreKey =
    entry.scoreLabel === 'Solved'
      ? 'solved'
      : entry.scoreLabel.toLowerCase().replaceAll(/\s+/g, '_');
  return `#${entry.rank} ${entry.displayName} ${scoreKey}=${entry.score} accepted=${entry.acceptedCount} submissions=${entry.submissionCount}`;
}
