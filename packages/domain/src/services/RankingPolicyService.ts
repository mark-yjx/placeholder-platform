import { Verdict } from '../judge';
import { RankedSubmissionRecord, RankingEntry } from '../ports';

const VERDICT_WEIGHT: Readonly<Record<Verdict, number>> = {
  AC: 5,
  WA: 4,
  TLE: 3,
  RE: 2,
  CE: 1
};

type UserAggregate = {
  solvedCount: number;
  totalAcceptedTimeMs: number;
  bestSubmissionCount: number;
};

export class RankingPolicyService {
  rank(submissions: readonly RankedSubmissionRecord[]): readonly RankingEntry[] {
    const bestByUserProblem = new Map<string, RankedSubmissionRecord>();
    for (const submission of submissions) {
      const key = `${submission.userId}::${submission.problemId}`;
      const current = bestByUserProblem.get(key);
      if (!current || this.isBetter(submission, current)) {
        bestByUserProblem.set(key, submission);
      }
    }

    const aggregateByUser = new Map<string, UserAggregate>();
    for (const best of bestByUserProblem.values()) {
      const aggregate = aggregateByUser.get(best.userId) ?? {
        solvedCount: 0,
        totalAcceptedTimeMs: 0,
        bestSubmissionCount: 0
      };
      aggregate.bestSubmissionCount += 1;
      if (best.verdict === Verdict.AC) {
        aggregate.solvedCount += 1;
        aggregate.totalAcceptedTimeMs += best.timeMs;
      }
      aggregateByUser.set(best.userId, aggregate);
    }

    const entries: RankingEntry[] = [];
    for (const [userId, aggregate] of aggregateByUser.entries()) {
      entries.push({
        userId,
        compositeScore: aggregate.solvedCount * 1_000_000 - aggregate.totalAcceptedTimeMs,
        solvedCount: aggregate.solvedCount,
        totalAcceptedTimeMs: aggregate.totalAcceptedTimeMs,
        bestSubmissionCount: aggregate.bestSubmissionCount
      });
    }

    return entries.sort((left, right) => {
      if (left.compositeScore !== right.compositeScore) return right.compositeScore - left.compositeScore;
      if (left.solvedCount !== right.solvedCount) return right.solvedCount - left.solvedCount;
      if (left.totalAcceptedTimeMs !== right.totalAcceptedTimeMs) {
        return left.totalAcceptedTimeMs - right.totalAcceptedTimeMs;
      }
      return left.userId.localeCompare(right.userId);
    });
  }

  private isBetter(candidate: RankedSubmissionRecord, current: RankedSubmissionRecord): boolean {
    if (VERDICT_WEIGHT[candidate.verdict] !== VERDICT_WEIGHT[current.verdict]) {
      return VERDICT_WEIGHT[candidate.verdict] > VERDICT_WEIGHT[current.verdict];
    }
    if (candidate.timeMs !== current.timeMs) {
      return candidate.timeMs < current.timeMs;
    }
    if (candidate.createdAtEpochMs !== current.createdAtEpochMs) {
      return candidate.createdAtEpochMs < current.createdAtEpochMs;
    }
    return candidate.submissionId.localeCompare(current.submissionId) < 0;
  }
}
