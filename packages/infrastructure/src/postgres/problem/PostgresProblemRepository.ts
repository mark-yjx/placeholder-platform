import {
  ProblemCrudRepository,
  ProblemVersionHistoryRepository,
  ProblemVersionTimelineEntry
} from '@packages/application/src/problem';
import { Problem, ProblemVersion, PublicationState } from '@packages/domain/src/problem';

type ProblemVersionRow = {
  problem_id: string;
  version_id: string;
  version_number: number;
  title: string;
  statement: string;
  publication_state: string;
};

type ProblemRow = {
  problem_id: string;
};

type TimelineRow = {
  version_id: string;
  version_number: number;
  title: string;
  publication_state: string;
};

type ProblemStarterAssetRow = {
  starter_code: string;
};

export interface PostgresSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  withTransaction<T>(work: (client: PostgresSqlClient) => Promise<T>): Promise<T>;
}

const FIND_PROBLEM_VERSIONS_SQL = `
SELECT
  pv.problem_id AS problem_id,
  pv.id AS version_id,
  pv.version_number AS version_number,
  pv.title AS title,
  pv.statement AS statement,
  pv.publication_state AS publication_state
FROM problem_versions pv
WHERE pv.problem_id = $1
ORDER BY pv.version_number ASC
`;

const LIST_PROBLEM_IDS_SQL = `
SELECT p.id AS problem_id
FROM problems p
ORDER BY p.id ASC
`;

const UPSERT_PROBLEM_SQL = `
INSERT INTO problems (id, title, publication_state)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    publication_state = EXCLUDED.publication_state
`;

const INSERT_PROBLEM_VERSION_SQL = `
INSERT INTO problem_versions (
  id,
  problem_id,
  version_number,
  title,
  statement,
  publication_state
)
VALUES ($1, $2, $3, $4, $5, $6)
`;

const DELETE_PROBLEM_SQL = `
DELETE FROM problems
WHERE id = $1
`;

const FIND_TIMELINE_SQL = `
SELECT
  pv.id AS version_id,
  pv.version_number AS version_number,
  pv.title AS title,
  pv.publication_state AS publication_state
FROM problem_versions pv
WHERE pv.problem_id = $1
ORDER BY pv.version_number ASC
`;

const FIND_PROBLEM_STARTER_SQL = `
SELECT pva.starter_code AS starter_code
FROM problem_version_assets pva
WHERE pva.problem_version_id = $1
LIMIT 1
`;

function parsePublicationState(value: string): PublicationState {
  if (value === PublicationState.DRAFT) {
    return PublicationState.DRAFT;
  }
  if (value === PublicationState.PUBLISHED) {
    return PublicationState.PUBLISHED;
  }
  if (value === PublicationState.UNPUBLISHED) {
    return PublicationState.UNPUBLISHED;
  }
  throw new Error(`Unsupported publication state: ${value}`);
}

function toProblemVersion(row: {
  version_id: string;
  version_number: number;
  title: string;
  statement: string;
  publication_state: string;
}): ProblemVersion {
  const base = ProblemVersion.createDraft({
    id: row.version_id,
    versionNumber: row.version_number,
    title: row.title,
    statement: row.statement
  });

  const publicationState = parsePublicationState(row.publication_state);
  if (publicationState === PublicationState.PUBLISHED) {
    return base.publish();
  }
  if (publicationState === PublicationState.UNPUBLISHED) {
    return base.unpublish();
  }
  return base;
}

function assertImmutableVersion(expected: ProblemVersion, row: ProblemVersionRow): void {
  if (
    expected.versionNumber !== row.version_number ||
    expected.title !== row.title ||
    expected.statement !== row.statement ||
    expected.publicationState !== row.publication_state
  ) {
    throw new Error(`Problem version ${expected.id} is immutable and cannot be modified`);
  }
}

export class PostgresProblemRepository
  implements ProblemCrudRepository, ProblemVersionHistoryRepository
{
  constructor(private readonly client: PostgresSqlClient) {}

  async findById(id: string): Promise<Problem | null> {
    const rows = await this.client.query<ProblemVersionRow>(FIND_PROBLEM_VERSIONS_SQL, [id]);
    if (rows.length === 0) {
      return null;
    }
    const versions = rows.map(toProblemVersion);
    return new Problem(id, versions);
  }

  async save(problem: Problem): Promise<void> {
    await this.client.withTransaction(async (tx) => {
      const latest = problem.latestVersion;
      await tx.execute(UPSERT_PROBLEM_SQL, [problem.id, latest.title, latest.publicationState]);

      const existingRows = await tx.query<ProblemVersionRow>(FIND_PROBLEM_VERSIONS_SQL, [problem.id]);
      const existingByVersionId = new Map(existingRows.map((row) => [row.version_id, row]));

      for (const version of problem.versions) {
        const existing = existingByVersionId.get(version.id);
        if (existing) {
          assertImmutableVersion(version, existing);
          continue;
        }

        await tx.execute(INSERT_PROBLEM_VERSION_SQL, [
          version.id,
          problem.id,
          version.versionNumber,
          version.title,
          version.statement,
          version.publicationState
        ]);
      }
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.client.execute(DELETE_PROBLEM_SQL, [id]);
  }

  async listAll(): Promise<readonly Problem[]> {
    const rows = await this.client.query<ProblemRow>(LIST_PROBLEM_IDS_SQL);
    const problems: Problem[] = [];
    for (const row of rows) {
      const problem = await this.findById(row.problem_id);
      if (problem) {
        problems.push(problem);
      }
    }
    return problems;
  }

  async findVersionTimeline(problemId: string): Promise<readonly ProblemVersionTimelineEntry[]> {
    const rows = await this.client.query<TimelineRow>(FIND_TIMELINE_SQL, [problemId]);
    return rows.map((row) => ({
      versionId: row.version_id,
      versionNumber: row.version_number,
      title: row.title,
      publicationState: parsePublicationState(row.publication_state)
    }));
  }

  async getStarterCode(versionId: string): Promise<string | null> {
    const rows = await this.client.query<ProblemStarterAssetRow>(FIND_PROBLEM_STARTER_SQL, [versionId]);
    return rows[0]?.starter_code ?? null;
  }
}
