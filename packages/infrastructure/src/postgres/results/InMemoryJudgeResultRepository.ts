import {
  JudgeResultPersistenceRepository,
  PersistedJudgeResult
} from '@placeholder/application/src/results/JudgeCallbackIngestionService';

export class InMemoryJudgeResultRepository implements JudgeResultPersistenceRepository {
  private readonly resultsBySubmissionId = new Map<string, PersistedJudgeResult>();

  async findBySubmissionId(submissionId: string): Promise<PersistedJudgeResult | null> {
    return this.resultsBySubmissionId.get(submissionId) ?? null;
  }

  async save(result: PersistedJudgeResult): Promise<void> {
    const existing = this.resultsBySubmissionId.get(result.submissionId);
    if (existing) {
      const same =
        existing.verdict === result.verdict &&
        existing.timeMs === result.timeMs &&
        existing.memoryKb === result.memoryKb;
      if (!same) {
        throw new Error('Judge result is immutable once persisted');
      }
      return;
    }

    this.resultsBySubmissionId.set(result.submissionId, { ...result });
  }
}
