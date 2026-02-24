export type PublicStatsSnapshot = {
  totalJudgedSubmissions: number;
  totalAcceptedSubmissions: number;
  acceptanceRatePercent: number;
  verdictBreakdown: Readonly<Record<string, number>>;
};

export interface PublicStatsProjectionRepository {
  getPublicSnapshot(): Promise<PublicStatsSnapshot>;
}

export class PublicStatsService {
  constructor(private readonly repository: PublicStatsProjectionRepository) {}

  async getPublicStats(): Promise<PublicStatsSnapshot> {
    const snapshot = await this.repository.getPublicSnapshot();
    if (snapshot.totalJudgedSubmissions <= 0) {
      throw new Error('Stats unavailable');
    }
    return snapshot;
  }
}
