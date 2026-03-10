import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { PostgresJudgeResultSqlClient } from '@placeholder/infrastructure/src/postgres/results';
import type { PostgresSubmissionSqlClient } from '@placeholder/infrastructure/src/postgres/submission';
import type { PostgresJudgeJobQueueSqlClient } from '@placeholder/infrastructure/src/queue';

type LocalPostgresSqlClient = PostgresSubmissionSqlClient &
  PostgresJudgeResultSqlClient &
  PostgresJudgeJobQueueSqlClient;

function resolveComposeFile(): string {
  const candidates = [
    path.resolve(process.cwd(), 'deploy/local/docker-compose.yml'),
    path.resolve(process.cwd(), '../../deploy/local/docker-compose.yml')
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return file;
    }
  }

  return candidates[0];
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite numbers are not supported in SQL params');
    }
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function applySqlParams(sql: string, params: readonly unknown[] = []): string {
  return sql.replace(/\$(\d+)/g, (_token, indexText) => {
    const index = Number(indexText) - 1;
    return toSqlLiteral(params[index]);
  });
}

function runPsql(sql: string): string {
  return execFileSync(
    'docker',
    [
      'compose',
      '-f',
      resolveComposeFile(),
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'oj',
      '-d',
      'oj',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      sql
    ],
    { encoding: 'utf8' }
  );
}

export function createLocalPostgresSqlClient(): LocalPostgresSqlClient {
  return {
    async query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> {
      const statement = applySqlParams(sql, params);
      const output = runPsql(`SELECT row_to_json(result_row) FROM (${statement}) result_row;`).trim();

      if (output.length === 0) {
        return [];
      }

      return output
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as T);
    },

    async execute(sql: string, params?: readonly unknown[]): Promise<void> {
      runPsql(applySqlParams(sql, params));
    }
  };
}
