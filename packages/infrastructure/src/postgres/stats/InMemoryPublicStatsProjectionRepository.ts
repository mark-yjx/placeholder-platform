import { PublicStatsProjectionRepository, PublicStatsSnapshot } from '@placeholder/application/src/stats';

export type SeededJudgedSubmission = {
  submissionId: string;
  verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';
};

export const DEFAULT_SEEDED_JUDGED_SUBMISSIONS: readonly SeededJudgedSubmission[] = [
  { submissionId: 'seed-1', verdict: 'AC' },
  { submissionId: 'seed-2', verdict: 'WA' },
  { submissionId: 'seed-3', verdict: 'AC' },
  { submissionId: 'seed-4', verdict: 'TLE' }
];

const ORDERED_VERDICTS: readonly SeededJudgedSubmission['verdict'][] = ['AC', 'WA', 'TLE', 'RE', 'CE'];

export class InMemoryPublicStatsProjectionRepository implements PublicStatsProjectionRepository {
  constructor(
    private readonly seededJudgedSubmissions: readonly SeededJudgedSubmission[] =
      DEFAULT_SEEDED_JUDGED_SUBMISSIONS
  ) {}

  async getPublicSnapshot(): Promise<PublicStatsSnapshot> {
    const verdictBreakdown: Record<string, number> = {};
    for (const verdict of ORDERED_VERDICTS) {
      verdictBreakdown[verdict] = 0;
    }

    for (const submission of this.seededJudgedSubmissions) {
      verdictBreakdown[submission.verdict] += 1;
    }

    const totalJudgedSubmissions = this.seededJudgedSubmissions.length;
    const totalAcceptedSubmissions = verdictBreakdown.AC;
    const acceptanceRatePercent =
      totalJudgedSubmissions === 0
        ? 0
        : Math.round((totalAcceptedSubmissions / totalJudgedSubmissions) * 100);

    return {
      totalJudgedSubmissions,
      totalAcceptedSubmissions,
      acceptanceRatePercent,
      verdictBreakdown
    };
  }
}
