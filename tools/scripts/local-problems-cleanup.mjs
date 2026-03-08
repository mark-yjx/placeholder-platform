#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy', 'local', 'docker-compose.yml');

function runPsql(args, options = {}) {
  return execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', 'oj', '-d', 'oj', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
      ...options
    }
  );
}

function queryScalar(sql) {
  return runPsql(['-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]).trim();
}

const collapseExists = Number.parseInt(
  queryScalar("SELECT COUNT(*) FROM problems WHERE id = 'collapse';"),
  10
);

if (collapseExists !== 1) {
  throw new Error('Cleanup aborted: expected exactly one existing collapse problem in Postgres.');
}

runPsql(['-v', 'ON_ERROR_STOP=1'], {
  input: `
BEGIN;

DELETE FROM judge_jobs
WHERE problem_id <> 'collapse';

DELETE FROM submissions
WHERE problem_id <> 'collapse';

DELETE FROM reviews
WHERE problem_id <> 'collapse';

DELETE FROM favorites
WHERE problem_id <> 'collapse';

DELETE FROM problem_version_tests
WHERE problem_version_id IN (
  SELECT id
  FROM problem_versions
  WHERE problem_id <> 'collapse'
);

DELETE FROM problem_version_assets
WHERE problem_version_id IN (
  SELECT id
  FROM problem_versions
  WHERE problem_id <> 'collapse'
);

ALTER TABLE problem_versions DISABLE TRIGGER trg_problem_versions_immutable;

DELETE FROM problem_versions
WHERE problem_id <> 'collapse';

ALTER TABLE problem_versions ENABLE TRIGGER trg_problem_versions_immutable;

DELETE FROM problems
WHERE id <> 'collapse';

COMMIT;
`
});

const remainingProblemIds = queryScalar(
  "SELECT COALESCE(string_agg(id, ',' ORDER BY id), '') FROM problems;"
);

console.log(`Cleanup complete. Remaining problem ids: ${remainingProblemIds}`);
