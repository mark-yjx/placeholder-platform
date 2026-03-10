import { SubmissionAdminRepository } from '@placeholder/application/src/submission/AdminSubmissionManagementService';
import {
  SubmissionCreationRepository,
  SubmissionRecord
} from '@placeholder/application/src/submission/CreateSubmissionUseCase';
import {
  assertSubmissionStartsQueued,
  assertValidSubmissionTransition
} from './submissionStateGuard';

export class InMemorySubmissionRepository
  implements SubmissionCreationRepository, SubmissionAdminRepository
{
  private readonly submissions = new Map<string, SubmissionRecord>();

  async findById(id: string): Promise<SubmissionRecord | null> {
    return this.submissions.get(id) ?? null;
  }

  async save(record: SubmissionRecord): Promise<void> {
    const existing = this.submissions.get(record.id);
    if (!existing) {
      assertSubmissionStartsQueued(record.status);
      this.submissions.set(record.id, { ...record });
      return;
    }

    if (
      existing.ownerUserId !== record.ownerUserId ||
      existing.problemId !== record.problemId ||
      existing.problemVersionId !== record.problemVersionId ||
      existing.language !== record.language ||
      existing.sourceCode !== record.sourceCode
    ) {
      throw new Error('Submission identity is immutable');
    }

    assertValidSubmissionTransition(existing.status, record.status);
    if (existing.status === record.status) {
      return;
    }
    this.submissions.set(record.id, { ...record });
  }

  async listAll(): Promise<readonly SubmissionRecord[]> {
    return Array.from(this.submissions.values());
  }

  async deleteById(id: string): Promise<void> {
    this.submissions.delete(id);
  }
}
