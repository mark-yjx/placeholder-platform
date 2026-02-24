import { Verdict } from '../judge';

export type RankingEntry = {
  userId: string;
  compositeScore: number;
  solvedCount: number;
  totalAcceptedTimeMs: number;
  bestSubmissionCount: number;
};

export interface RankingRepository {
  listJudgedSubmissions(): Promise<readonly RankedSubmissionRecord[]>;
}

export type RankedSubmissionRecord = {
  submissionId: string;
  userId: string;
  problemId: string;
  verdict: Verdict;
  timeMs: number;
  createdAtEpochMs: number;
};
