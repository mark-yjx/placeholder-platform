import { SubmissionAdminRepository } from '@packages/application/src/submission/AdminSubmissionManagementService';
import {
  SubmissionCreationRepository,
  SubmissionRecord
} from '@packages/application/src/submission/CreateSubmissionUseCase';
import { SubmissionStateRepository } from '@packages/application/src/results/JudgeCallbackIngestionService';
import { SubmissionResultReadRepository } from '@packages/application/src/results/ResultQueryService';
import { SubmissionStatus } from '@packages/domain/src/submission';
import {
  assertSubmissionStartsQueued,
  assertValidSubmissionTransition
} from './submissionStateGuard';

export interface PostgresSubmissionSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

type SubmissionRow = {
  id: string;
  owner_user_id: string;
  problem_id: string;
  problem_version_id: string;
  language: string;
  source_code: string;
  status: SubmissionStatus;
};

const FIND_SUBMISSION_BY_ID_SQL = `
SELECT
  id,
  user_id AS owner_user_id,
  problem_id,
  problem_version_id,
  language,
  source_code,
  status
FROM submissions
WHERE id = $1
`;

const LIST_SUBMISSIONS_SQL = `
SELECT
  id,
  user_id AS owner_user_id,
  problem_id,
  problem_version_id,
  language,
  source_code,
  status
FROM submissions
ORDER BY created_at ASC, id ASC
`;

const INSERT_SUBMISSION_SQL = `
INSERT INTO submissions (
  id,
  user_id,
  problem_id,
  problem_version_id,
  language,
  source_code,
  status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
`;

const UPDATE_SUBMISSION_STATUS_SQL = `
UPDATE submissions
SET status = $2
WHERE id = $1
`;

const DELETE_SUBMISSION_SQL = `
DELETE FROM submissions
WHERE id = $1
`;

function toSubmissionRecord(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    problemId: row.problem_id,
    problemVersionId: row.problem_version_id,
    language: row.language,
    sourceCode: row.source_code,
    status: row.status
  };
}

function assertSubmissionIdentityIsImmutable(
  existing: SubmissionRecord,
  candidate: SubmissionRecord
): void {
  if (
    existing.ownerUserId !== candidate.ownerUserId ||
    existing.problemId !== candidate.problemId ||
    existing.problemVersionId !== candidate.problemVersionId ||
    existing.language !== candidate.language ||
    existing.sourceCode !== candidate.sourceCode
  ) {
    throw new Error('Submission identity is immutable');
  }
}

export class PostgresSubmissionRepository
  implements
    SubmissionCreationRepository,
    SubmissionAdminRepository,
    SubmissionStateRepository,
    SubmissionResultReadRepository
{
  constructor(private readonly client: PostgresSubmissionSqlClient) {}

  async findById(id: string): Promise<SubmissionRecord | null> {
    const rows = await this.client.query<SubmissionRow>(FIND_SUBMISSION_BY_ID_SQL, [id]);
    return rows[0] ? toSubmissionRecord(rows[0]) : null;
  }

  async save(record: SubmissionRecord): Promise<void> {
    const existing = await this.findById(record.id);

    if (!existing) {
      assertSubmissionStartsQueued(record.status);
      await this.client.execute(INSERT_SUBMISSION_SQL, [
        record.id,
        record.ownerUserId,
        record.problemId,
        record.problemVersionId,
        record.language,
        record.sourceCode,
        record.status
      ]);
      return;
    }

    assertSubmissionIdentityIsImmutable(existing, record);
    assertValidSubmissionTransition(existing.status, record.status);

    if (existing.status === record.status) {
      return;
    }

    await this.client.execute(UPDATE_SUBMISSION_STATUS_SQL, [record.id, record.status]);
  }

  async listAll(): Promise<readonly SubmissionRecord[]> {
    const rows = await this.client.query<SubmissionRow>(LIST_SUBMISSIONS_SQL);
    return rows.map(toSubmissionRecord);
  }

  async deleteById(id: string): Promise<void> {
    await this.client.execute(DELETE_SUBMISSION_SQL, [id]);
  }
}
