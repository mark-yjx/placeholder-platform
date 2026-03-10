export type ReviewSentiment = 'like' | 'dislike';

export type ProblemReview = {
  reviewId: string;
  problemId: string;
  content: string;
  sentiment: ReviewSentiment;
};

export type StatsBreakdownView = {
  key: string;
  count: number;
};

export type StudentBadgeView = {
  id: 'first_ac' | 'solved_10' | 'solved_50' | 'streak_7' | 'streak_30';
  title: string;
  description: string;
  earned: boolean;
};

export type StudentStatsView = {
  userId: string;
  displayName: string;
  solvedCount: number;
  solvedByDifficulty: readonly StatsBreakdownView[];
  submissionCount: number;
  acceptedCount: number;
  acceptanceRate: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  languageBreakdown: readonly StatsBreakdownView[];
  tagBreakdown: readonly StatsBreakdownView[];
  badges: readonly StudentBadgeView[];
};

export type LeaderboardScope = 'all-time' | 'weekly' | 'monthly' | 'streak';

export type LeaderboardEntryView = {
  rank: number;
  userId: string;
  displayName: string;
  solvedCount: number;
  acceptedCount: number;
  submissionCount: number;
  currentStreak: number;
  longestStreak: number;
  score: number;
  scoreLabel: string;
};

export type LeaderboardView = {
  scope: LeaderboardScope;
  title: string;
  formula: string;
  generatedAt: string;
  windowStart?: string;
  windowEnd?: string;
  entries: readonly LeaderboardEntryView[];
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

  getMyStats(accessToken: string): Promise<StudentStatsView>;
  getLeaderboard(accessToken: string, scope: LeaderboardScope): Promise<LeaderboardView>;
}
