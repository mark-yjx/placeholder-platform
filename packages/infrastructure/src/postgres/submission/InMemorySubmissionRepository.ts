import {
  SubmissionCreationRepository,
  SubmissionRecord
} from '@packages/application/src/submission/CreateSubmissionUseCase';

export class InMemorySubmissionRepository implements SubmissionCreationRepository {
  private readonly submissions = new Map<string, SubmissionRecord>();

  async findById(id: string): Promise<SubmissionRecord | null> {
    return this.submissions.get(id) ?? null;
  }

  async save(record: SubmissionRecord): Promise<void> {
    this.submissions.set(record.id, { ...record });
  }
}
