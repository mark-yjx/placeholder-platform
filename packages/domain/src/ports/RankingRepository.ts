export type RankingEntry = {
  userId: string;
  score: number;
  solvedCount: number;
};

export interface RankingRepository {
  listEntries(): Promise<readonly RankingEntry[]>;
}
