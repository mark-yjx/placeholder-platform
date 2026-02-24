import { PublicRankingProjectionRepository } from '@packages/application/src/stats';
import { Judge, Ports } from '@packages/domain/src';

export const DEFAULT_SEEDED_RANKING_SUBMISSIONS: readonly Ports.RankedSubmissionRecord[] = [
  {
    submissionId: 'r-1',
    userId: 'student-a',
    problemId: 'p1',
    verdict: Judge.Verdict.WA,
    timeMs: 20,
    createdAtEpochMs: 1
  },
  {
    submissionId: 'r-2',
    userId: 'student-a',
    problemId: 'p1',
    verdict: Judge.Verdict.AC,
    timeMs: 180,
    createdAtEpochMs: 2
  },
  {
    submissionId: 'r-3',
    userId: 'student-a',
    problemId: 'p2',
    verdict: Judge.Verdict.AC,
    timeMs: 250,
    createdAtEpochMs: 3
  },
  {
    submissionId: 'r-4',
    userId: 'student-b',
    problemId: 'p1',
    verdict: Judge.Verdict.AC,
    timeMs: 90,
    createdAtEpochMs: 1
  },
  {
    submissionId: 'r-5',
    userId: 'student-b',
    problemId: 'p2',
    verdict: Judge.Verdict.AC,
    timeMs: 100,
    createdAtEpochMs: 2
  },
  {
    submissionId: 'r-6',
    userId: 'student-c',
    problemId: 'p1',
    verdict: Judge.Verdict.AC,
    timeMs: 80,
    createdAtEpochMs: 1
  }
];

export class InMemoryPublicRankingProjectionRepository implements PublicRankingProjectionRepository {
  constructor(
    private readonly seededSubmissions: readonly Ports.RankedSubmissionRecord[] =
      DEFAULT_SEEDED_RANKING_SUBMISSIONS
  ) {}

  async listJudgedSubmissions(): Promise<readonly Ports.RankedSubmissionRecord[]> {
    return this.seededSubmissions.map((submission) => ({ ...submission }));
  }
}
