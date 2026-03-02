import { ResourceLimits } from './judgePolicy';

export interface ProblemExecutionConfigRepository {
  findLimitsByProblemId(problemId: string): Promise<Partial<ResourceLimits> | null>;
}

export type ProblemJudgeTestCase = {
  testType: 'public' | 'hidden';
  position: number;
  input: unknown;
  expected: unknown;
};

export type ProblemJudgeConfig = {
  entryFunction: string;
  tests: readonly ProblemJudgeTestCase[];
};

export interface ProblemJudgeConfigRepository {
  findByProblemVersionId(problemVersionId: string): Promise<ProblemJudgeConfig | null>;
}

export class InMemoryProblemExecutionConfigRepository implements ProblemExecutionConfigRepository {
  private readonly overridesByProblemId = new Map<string, Partial<ResourceLimits>>();

  setOverride(problemId: string, limits: Partial<ResourceLimits>): void {
    this.overridesByProblemId.set(problemId, { ...limits });
  }

  async findLimitsByProblemId(problemId: string): Promise<Partial<ResourceLimits> | null> {
    return this.overridesByProblemId.get(problemId) ?? null;
  }
}

export class InMemoryProblemJudgeConfigRepository implements ProblemJudgeConfigRepository {
  private readonly configsByProblemVersionId = new Map<string, ProblemJudgeConfig>();

  set(problemVersionId: string, config: ProblemJudgeConfig): void {
    this.configsByProblemVersionId.set(problemVersionId, {
      entryFunction: config.entryFunction,
      tests: [...config.tests]
    });
  }

  async findByProblemVersionId(problemVersionId: string): Promise<ProblemJudgeConfig | null> {
    return this.configsByProblemVersionId.get(problemVersionId) ?? null;
  }
}

type ProblemJudgeConfigSqlClient = {
  query: <T>(sql: string, params?: readonly unknown[]) => Promise<readonly T[]>;
};

type ProblemJudgeConfigRow = {
  entry_function: string;
  test_type: 'public' | 'hidden';
  position: number;
  input: unknown;
  expected: unknown;
};

const FIND_PROBLEM_JUDGE_CONFIG_SQL = `
SELECT
  pva.entry_function AS entry_function,
  pvt.test_type AS test_type,
  pvt.position AS position,
  pvt.input AS input,
  pvt.expected AS expected
FROM problem_version_assets pva
JOIN problem_version_tests pvt
  ON pvt.problem_version_id = pva.problem_version_id
WHERE pva.problem_version_id = $1
ORDER BY
  CASE pvt.test_type WHEN 'public' THEN 0 ELSE 1 END ASC,
  pvt.position ASC
`;

export class PostgresProblemJudgeConfigRepository implements ProblemJudgeConfigRepository {
  constructor(private readonly client: ProblemJudgeConfigSqlClient) {}

  async findByProblemVersionId(problemVersionId: string): Promise<ProblemJudgeConfig | null> {
    const rows = await this.client.query<ProblemJudgeConfigRow>(FIND_PROBLEM_JUDGE_CONFIG_SQL, [
      problemVersionId
    ]);
    if (rows.length === 0) {
      return null;
    }

    return {
      entryFunction: rows[0].entry_function,
      tests: rows.map((row) => ({
        testType: row.test_type,
        position: row.position,
        input: row.input,
        expected: row.expected
      }))
    };
  }
}
