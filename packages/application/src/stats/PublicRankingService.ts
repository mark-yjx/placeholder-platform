import { Ports, Services } from '@placeholder/domain/src';

export type PublicRankingEntry = Ports.RankingEntry;

export interface PublicRankingProjectionRepository {
  listJudgedSubmissions(): Promise<readonly Ports.RankedSubmissionRecord[]>;
}

export class PublicRankingService {
  constructor(
    private readonly repository: PublicRankingProjectionRepository,
    private readonly policy: Services.RankingPolicyService = new Services.RankingPolicyService()
  ) {}

  async getPublicRanking(): Promise<readonly PublicRankingEntry[]> {
    const judgedSubmissions = await this.repository.listJudgedSubmissions();
    return this.policy.rank(judgedSubmissions);
  }
}
