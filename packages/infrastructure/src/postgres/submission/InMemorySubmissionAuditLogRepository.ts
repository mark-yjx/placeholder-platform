import {
  SubmissionAuditLogEntry,
  SubmissionAuditLogRepository
} from '@packages/application/src/submission/AdminSubmissionManagementService';

export class InMemorySubmissionAuditLogRepository implements SubmissionAuditLogRepository {
  private readonly entries: SubmissionAuditLogEntry[] = [];

  async record(entry: SubmissionAuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  listEntries(): readonly SubmissionAuditLogEntry[] {
    return [...this.entries];
  }
}
