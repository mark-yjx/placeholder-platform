import { RankingEntry } from '../ports';

export class RankingPolicyService {
  rank(entries: readonly RankingEntry[]): readonly RankingEntry[] {
    return [...entries].sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.solvedCount !== right.solvedCount) return right.solvedCount - left.solvedCount;
      return left.userId.localeCompare(right.userId);
    });
  }
}
