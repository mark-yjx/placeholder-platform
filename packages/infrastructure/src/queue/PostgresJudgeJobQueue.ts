import { JudgeJobQueue } from '@placeholder/application/src/submission/CreateSubmissionUseCase';
import { Judge } from '@placeholder/contracts/src';

export interface PostgresJudgeJobQueueSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

type JudgeJobRow = {
  submission_id: string;
  owner_user_id: string;
  problem_id: string;
  problem_version_id: string;
  language: string;
  source_code: string;
};

const INSERT_JUDGE_JOB_SQL = `
INSERT INTO judge_jobs (
  submission_id,
  owner_user_id,
  problem_id,
  problem_version_id,
  language,
  source_code
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (submission_id) DO NOTHING
`;

const LIST_JUDGE_JOBS_SQL = `
SELECT
  submission_id,
  owner_user_id,
  problem_id,
  problem_version_id,
  language,
  source_code
FROM judge_jobs
ORDER BY created_at ASC, submission_id ASC
`;

const CLAIM_NEXT_JUDGE_JOB_SQL = `
SELECT
  submission_id,
  owner_user_id,
  problem_id,
  problem_version_id,
  language,
  source_code
FROM judge_jobs
ORDER BY created_at ASC, submission_id ASC
LIMIT 1
`;

const DELETE_JUDGE_JOB_SQL = `
DELETE FROM judge_jobs
WHERE submission_id = $1
`;

function toJudgeJob(row: JudgeJobRow): Judge.JudgeJob {
  return {
    submissionId: row.submission_id,
    ownerUserId: row.owner_user_id,
    problemId: row.problem_id,
    problemVersionId: row.problem_version_id,
    language: row.language,
    sourceCode: row.source_code
  };
}

export class PostgresJudgeJobQueue implements JudgeJobQueue {
  constructor(private readonly client: PostgresJudgeJobQueueSqlClient) {}

  async enqueue(job: Judge.JudgeJob): Promise<void> {
    Judge.validateJudgeJob(job);
    await this.client.execute(INSERT_JUDGE_JOB_SQL, [
      job.submissionId,
      job.ownerUserId,
      job.problemId,
      job.problemVersionId,
      job.language,
      job.sourceCode
    ]);
  }

  async listJobs(): Promise<readonly Judge.JudgeJob[]> {
    const rows = await this.client.query<JudgeJobRow>(LIST_JUDGE_JOBS_SQL);
    return rows.map(toJudgeJob);
  }

  async claimNext(): Promise<Judge.JudgeJob | null> {
    const rows = await this.client.query<JudgeJobRow>(CLAIM_NEXT_JUDGE_JOB_SQL);
    return rows[0] ? toJudgeJob(rows[0]) : null;
  }

  async acknowledge(submissionId: string): Promise<void> {
    await this.client.execute(DELETE_JUDGE_JOB_SQL, [submissionId]);
  }
}
