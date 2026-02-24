import { Verdict } from '@packages/domain/src/judge';
import { SubmissionStatus } from '@packages/domain/src/submission';
import { SubmissionRecord } from '../submission/CreateSubmissionUseCase';

export type JudgeCallback = {
  submissionId: string;
  verdict: Verdict;
  timeMs: number;
  memoryKb: number;
};

export type PersistedJudgeResult = {
  submissionId: string;
  verdict: Verdict;
  timeMs: number;
  memoryKb: number;
};

export interface SubmissionStateRepository {
  findById(id: string): Promise<SubmissionRecord | null>;
  save(record: SubmissionRecord): Promise<void>;
}

export interface JudgeResultPersistenceRepository {
  findBySubmissionId(submissionId: string): Promise<PersistedJudgeResult | null>;
  save(result: PersistedJudgeResult): Promise<void>;
}

export class JudgeCallbackIngestionService {
  constructor(
    private readonly submissions: SubmissionStateRepository,
    private readonly results: JudgeResultPersistenceRepository
  ) {}

  async ingest(callback: JudgeCallback): Promise<PersistedJudgeResult> {
    const existing = await this.results.findBySubmissionId(callback.submissionId);
    if (existing) {
      const same =
        existing.verdict === callback.verdict &&
        existing.timeMs === callback.timeMs &&
        existing.memoryKb === callback.memoryKb;
      if (!same) {
        throw new Error('Conflicting judge callback');
      }
      return existing;
    }

    const submission = await this.submissions.findById(callback.submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (
      submission.status !== SubmissionStatus.FINISHED &&
      submission.status !== SubmissionStatus.FAILED
    ) {
      await this.submissions.save({
        ...submission,
        status: SubmissionStatus.FINISHED
      });
    }

    const result: PersistedJudgeResult = {
      submissionId: callback.submissionId,
      verdict: callback.verdict,
      timeMs: callback.timeMs,
      memoryKb: callback.memoryKb
    };
    await this.results.save(result);
    return result;
  }
}
