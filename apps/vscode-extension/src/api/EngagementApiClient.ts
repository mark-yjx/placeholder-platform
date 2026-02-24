export type ReviewSentiment = 'like' | 'dislike';

export type ProblemReview = {
  reviewId: string;
  problemId: string;
  content: string;
  sentiment: ReviewSentiment;
};

export type PublicStatsView = {
  totalJudgedSubmissions: number;
  totalAcceptedSubmissions: number;
  acceptanceRatePercent: number;
};

export type PublicRankingEntry = {
  userId: string;
  compositeScore: number;
  solvedCount: number;
  totalAcceptedTimeMs: number;
};

export interface EngagementApiClient {
  addFavorite(accessToken: string, problemId: string): Promise<void>;
  removeFavorite(accessToken: string, problemId: string): Promise<void>;
  listFavorites(accessToken: string): Promise<readonly string[]>;

  createReview(
    accessToken: string,
    request: { problemId: string; content: string; sentiment: ReviewSentiment }
  ): Promise<ProblemReview>;
  listReviews(accessToken: string, problemId: string): Promise<readonly ProblemReview[]>;

  getPublicStats(accessToken: string): Promise<PublicStatsView>;
  getPublicRanking(accessToken: string): Promise<readonly PublicRankingEntry[]>;
}
