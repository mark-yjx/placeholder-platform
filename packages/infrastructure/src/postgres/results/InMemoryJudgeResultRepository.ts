import {
  JudgeResultPersistenceRepository,
  PersistedJudgeResult
} from '@packages/application/src/results/JudgeCallbackIngestionService';

export class InMemoryJudgeResultRepository implements JudgeResultPersistenceRepository {
  private readonly resultsBySubmissionId = new Map<string, PersistedJudgeResult>();

  async findBySubmissionId(submissionId: string): Promise<PersistedJudgeResult | null> {
    return this.resultsBySubmissionId.get(submissionId) ?? null;
  }

  async save(result: PersistedJudgeResult): Promise<void> {
    this.resultsBySubmissionId.set(result.submissionId, { ...result });
  }
}
