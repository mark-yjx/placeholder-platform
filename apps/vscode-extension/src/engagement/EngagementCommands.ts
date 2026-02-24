import {
  EngagementApiClient,
  ProblemReview,
  PublicRankingEntry,
  PublicStatsView,
  ReviewSentiment
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

  async showPublicStats(): Promise<string> {
    const stats = await runProtectedCommand(this.tokenStore, async () =>
      this.apiClient.getPublicStats(this.requireAccessToken())
    );
    return formatStats(stats);
  }

  async showPublicRanking(): Promise<readonly string[]> {
    const ranking = await runProtectedCommand(this.tokenStore, async () =>
      this.apiClient.getPublicRanking(this.requireAccessToken())
    );
    return ranking.map((entry, index) => formatRankingEntry(index + 1, entry));
  }

  private requireAccessToken(): string {
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return token;
  }
}

export function formatStats(stats: PublicStatsView): string {
  return `judged=${stats.totalJudgedSubmissions}, accepted=${stats.totalAcceptedSubmissions}, rate=${stats.acceptanceRatePercent}%`;
}

export function formatRankingEntry(rank: number, entry: PublicRankingEntry): string {
  return `#${rank} ${entry.userId} score=${entry.compositeScore} solved=${entry.solvedCount} acceptedTimeMs=${entry.totalAcceptedTimeMs}`;
}
