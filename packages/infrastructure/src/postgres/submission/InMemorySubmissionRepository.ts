import { SubmissionAdminRepository } from '@packages/application/src/submission/AdminSubmissionManagementService';
import {
  SubmissionCreationRepository,
  SubmissionRecord
} from '@packages/application/src/submission/CreateSubmissionUseCase';

export class InMemorySubmissionRepository
  implements SubmissionCreationRepository, SubmissionAdminRepository
{
  private readonly submissions = new Map<string, SubmissionRecord>();

  async findById(id: string): Promise<SubmissionRecord | null> {
    return this.submissions.get(id) ?? null;
  }

  async save(record: SubmissionRecord): Promise<void> {
    this.submissions.set(record.id, { ...record });
  }

  async listAll(): Promise<readonly SubmissionRecord[]> {
    return Array.from(this.submissions.values());
  }

  async deleteById(id: string): Promise<void> {
    this.submissions.delete(id);
  }
}
