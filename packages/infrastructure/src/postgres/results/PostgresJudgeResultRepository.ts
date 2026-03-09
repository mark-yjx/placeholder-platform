import {
  JudgeResultPersistenceRepository,
  PersistedJudgeResult
} from '@packages/application/src/results/JudgeCallbackIngestionService';
import { JudgeResultReadRepository } from '@packages/application/src/results/ResultQueryService';

export interface PostgresJudgeResultSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
}

type JudgeResultRow = {
  submission_id: string;
  verdict: PersistedJudgeResult['verdict'];
  time_ms: number | null;
  memory_kb: number | null;
};

const FIND_RESULT_BY_SUBMISSION_ID_SQL = `
SELECT
  submission_id,
  verdict,
  time_ms,
  memory_kb
FROM judge_results
WHERE submission_id = $1
`;

const INSERT_RESULT_SQL = `
INSERT INTO judge_results (
  submission_id,
  verdict,
  time_ms,
  memory_kb
)
VALUES ($1, $2, $3, $4)
`;

function toPersistedJudgeResult(row: JudgeResultRow): PersistedJudgeResult {
  return {
    submissionId: row.submission_id,
    verdict: row.verdict,
    timeMs: row.time_ms ?? undefined,
    memoryKb: row.memory_kb ?? undefined
  };
}

export class PostgresJudgeResultRepository
  implements JudgeResultPersistenceRepository, JudgeResultReadRepository
{
  constructor(private readonly client: PostgresJudgeResultSqlClient) {}

  async findBySubmissionId(submissionId: string): Promise<PersistedJudgeResult | null> {
    const rows = await this.client.query<JudgeResultRow>(FIND_RESULT_BY_SUBMISSION_ID_SQL, [
      submissionId
    ]);
    return rows[0] ? toPersistedJudgeResult(rows[0]) : null;
  }

  async save(result: PersistedJudgeResult): Promise<void> {
    const existing = await this.findBySubmissionId(result.submissionId);
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

    await this.client.execute(INSERT_RESULT_SQL, [
      result.submissionId,
      result.verdict,
      result.timeMs ?? null,
      result.memoryKb ?? null
    ]);
  }
}
