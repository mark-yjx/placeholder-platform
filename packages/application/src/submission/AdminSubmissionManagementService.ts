import { SubmissionStatus } from '@packages/domain/src/submission';
import { SubmissionRecord } from './CreateSubmissionUseCase';

export interface SubmissionAdminRepository {
  findById(id: string): Promise<SubmissionRecord | null>;
  listAll(): Promise<readonly SubmissionRecord[]>;
  save(record: SubmissionRecord): Promise<void>;
  deleteById(id: string): Promise<void>;
}

export type SubmissionAuditLogEntry = {
  actorUserId: string;
  action: string;
  submissionId?: string;
  occurredAt: string;
};

export interface SubmissionAuditLogRepository {
  record(entry: SubmissionAuditLogEntry): Promise<void>;
}

export class AdminSubmissionManagementService {
  constructor(
    private readonly submissions: SubmissionAdminRepository,
    private readonly auditLogs: SubmissionAuditLogRepository
  ) {}

  async view(actorUserId: string): Promise<readonly SubmissionRecord[]> {
    const items = await this.submissions.listAll();
    await this.auditLogs.record({
      actorUserId,
      action: 'submission.admin.view',
      occurredAt: new Date().toISOString()
    });
    return items;
  }

  async rejudge(actorUserId: string, submissionId: string): Promise<SubmissionRecord> {
    const existing = await this.submissions.findById(submissionId);
    if (!existing) {
      throw new Error('Submission not found');
    }
    const updated: SubmissionRecord = {
      ...existing,
      status: SubmissionStatus.QUEUED
    };
    await this.submissions.save(updated);
    await this.auditLogs.record({
      actorUserId,
      action: 'submission.admin.rejudge',
      submissionId,
      occurredAt: new Date().toISOString()
    });
    return updated;
  }

  async delete(actorUserId: string, submissionId: string): Promise<void> {
    await this.submissions.deleteById(submissionId);
    await this.auditLogs.record({
      actorUserId,
      action: 'submission.admin.delete',
      submissionId,
      occurredAt: new Date().toISOString()
    });
  }

  async export(actorUserId: string): Promise<string> {
    const items = await this.submissions.listAll();
    const header = 'submissionId,ownerUserId,problemId,problemVersionId,language,status';
    const rows = items.map((item) =>
      [
        item.id,
        item.ownerUserId,
        item.problemId,
        item.problemVersionId,
        item.language,
        item.status
      ].join(',')
    );
    await this.auditLogs.record({
      actorUserId,
      action: 'submission.admin.export',
      occurredAt: new Date().toISOString()
    });
    return [header, ...rows].join('\n');
  }
}
