#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MEMORY_LIMIT_KB = 65536;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

function resolveComposeFile() {
  return path.join(root, 'deploy', 'local', 'docker-compose.yml');
}

function toSqlLiteral(value) {
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

function applySqlParams(sql, params = []) {
  return sql.replace(/\$(\d+)/g, (_token, indexText) => {
    const index = Number(indexText) - 1;
    return toSqlLiteral(params[index]);
  });
}

function runPsql(sql) {
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

export function createLocalProblemImportSqlClient() {
  return {
    async query(sql, params = []) {
      const statement = applySqlParams(sql, params);
      const output = runPsql(`SELECT row_to_json(result_row) FROM (${statement}) result_row;`).trim();

      if (output.length === 0) {
        return [];
      }

      return output
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    },

    async execute(sql, params = []) {
      runPsql(applySqlParams(sql, params));
    }
  };
}

function skipJsonWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function parseJsonStringToken(source, index) {
  let cursor = index + 1;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '"') {
      return cursor + 1;
    }
    cursor += 1;
  }
  throw new Error('Unterminated JSON string literal');
}

function parseJsonValueToken(source, index) {
  const start = skipJsonWhitespace(source, index);
  const first = source[start];

  if (first === '"') {
    return parseJsonStringToken(source, start);
  }

  if (first === '{' || first === '[') {
    const stack = [first];
    let cursor = start + 1;
    while (cursor < source.length && stack.length > 0) {
      const char = source[cursor];
      if (char === '"') {
        cursor = parseJsonStringToken(source, cursor);
        continue;
      }
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' && stack[stack.length - 1] === '{') {
        stack.pop();
      } else if (char === ']' && stack[stack.length - 1] === '[') {
        stack.pop();
      }
      cursor += 1;
    }
    if (stack.length > 0) {
      throw new Error('Unterminated JSON container value');
    }
    return cursor;
  }

  let cursor = start;
  while (cursor < source.length && !/[,\]}]/.test(source[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function parseJsonCasesWithRawValues(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  let cursor = skipJsonWhitespace(source, 0);
  if (source[cursor] !== '[') {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  cursor += 1;
  const cases = [];

  while (true) {
    cursor = skipJsonWhitespace(source, cursor);
    if (source[cursor] === ']') {
      break;
    }
    if (source[cursor] !== '{') {
      throw new Error(`Expected JSON object in ${filePath}`);
    }
    cursor += 1;

    let inputJson = null;
    let expectedJson = null;

    while (true) {
      cursor = skipJsonWhitespace(source, cursor);
      if (source[cursor] === '}') {
        cursor += 1;
        break;
      }

      const keyStart = cursor;
      const keyEnd = parseJsonStringToken(source, keyStart);
      const key = JSON.parse(source.slice(keyStart, keyEnd));
      cursor = skipJsonWhitespace(source, keyEnd);
      if (source[cursor] !== ':') {
        throw new Error(`Expected ":" after key ${key} in ${filePath}`);
      }
      cursor += 1;

      const valueStart = skipJsonWhitespace(source, cursor);
      const valueEnd = parseJsonValueToken(source, valueStart);
      const rawValue = source.slice(valueStart, valueEnd).trim();
      if (key === 'input') {
        inputJson = rawValue;
      } else if (key === 'expected') {
        expectedJson = rawValue;
      }
      cursor = skipJsonWhitespace(source, valueEnd);
      if (source[cursor] === ',') {
        cursor += 1;
        continue;
      }
      if (source[cursor] === '}') {
        cursor += 1;
        break;
      }
    }

    if (inputJson === null || expectedJson === null) {
      throw new Error(`Each test case in ${filePath} must define input and expected`);
    }

    cases.push({ inputJson, expectedJson });
    cursor = skipJsonWhitespace(source, cursor);
    if (source[cursor] === ',') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === ']') {
      break;
    }
  }

  return cases;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((result, key) => {
        result[key] = stableJson(value[key]);
        return result;
      }, {});
  }
  return value;
}

export function createContentDigest(problem) {
  const payload = {
    slug: problem.slug,
    title: problem.title,
    statement: problem.statement,
    starterCode: problem.starterCode,
    publicTests: problem.publicTests,
    hiddenTests: problem.hiddenTests,
    entryFunction: problem.entryFunction,
    language: problem.language,
    visibility: problem.visibility,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitKb: problem.memoryLimitKb
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableJson(payload)))
    .digest('hex');
}

function readRequiredTextFile(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Missing required ${label}: ${filePath}`);
    }
    throw error;
  }
}

function parseManifestJson(problemDir) {
  const manifestPath = path.join(problemDir, 'manifest.json');
  const raw = readRequiredTextFile(manifestPath, 'manifest file');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid manifest JSON at ${manifestPath}: ${message}`);
  }
}

export function readProblemDefinition(problemDir) {
  const metadata = parseManifestJson(problemDir);
  const statement = readRequiredTextFile(path.join(problemDir, 'statement.md'), 'statement file');
  const starterCode = readRequiredTextFile(path.join(problemDir, 'starter.py'), 'starter file');
  const publicTests = parseJsonCasesWithRawValues(path.join(problemDir, 'public.json'));
  const hiddenTests = parseJsonCasesWithRawValues(path.join(problemDir, 'hidden.json'));

  if (typeof metadata.problemId !== 'string' || metadata.problemId.trim().length === 0) {
    throw new Error(`Problem at ${problemDir} must define a non-empty problemId`);
  }
  if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
    throw new Error(`Problem ${metadata.problemId} must define a non-empty title`);
  }
  if (typeof metadata.entryFunction !== 'string' || metadata.entryFunction.trim().length === 0) {
    throw new Error(`Problem ${metadata.problemId} must define a non-empty entryFunction`);
  }
  if (metadata.language !== 'python') {
    throw new Error(`Problem ${metadata.problemId} must use language "python"`);
  }
  if (metadata.visibility !== 'public' && metadata.visibility !== 'private') {
    throw new Error(`Problem ${metadata.problemId} must use visibility "public" or "private"`);
  }

  const definition = {
    slug: metadata.problemId.trim(),
    title: metadata.title.trim(),
    statement,
    starterCode,
    publicTests,
    hiddenTests,
    entryFunction: metadata.entryFunction.trim(),
    language: 'python',
    visibility: metadata.visibility,
    timeLimitMs: Number.isInteger(metadata.timeLimitMs) ? metadata.timeLimitMs : DEFAULT_TIME_LIMIT_MS,
    memoryLimitKb: Number.isInteger(metadata.memoryLimitKb)
      ? metadata.memoryLimitKb
      : DEFAULT_MEMORY_LIMIT_KB
  };

  if (definition.timeLimitMs <= 0) {
    throw new Error(`Problem ${definition.slug} must define a positive timeLimitMs`);
  }
  if (definition.memoryLimitKb <= 0) {
    throw new Error(`Problem ${definition.slug} must define a positive memoryLimitKb`);
  }

  return {
    ...definition,
    contentDigest: createContentDigest(definition)
  };
}

export function readProblemDefinitions(problemRootDir) {
  const entries = fs
    .readdirSync(problemRootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  return entries.map((entry) => readProblemDefinition(path.join(problemRootDir, entry.name)));
}

export function createInMemoryProblemImportStore() {
  const problems = new Map();

  return {
    async getLatestImport(slug) {
      const problem = problems.get(slug);
      if (!problem) {
        return null;
      }

      const latestVersion = problem.versions[problem.versions.length - 1];
      return {
        slug,
        latestVersionNumber: latestVersion.versionNumber,
        latestDigest: latestVersion.contentDigest
      };
    },

    async insertInitialProblem(problem) {
      problems.set(problem.slug, {
        slug: problem.slug,
        versions: [
          {
            versionNumber: 1,
            contentDigest: problem.contentDigest,
            title: problem.title,
            statement: problem.statement
          }
        ]
      });
    },

    async appendProblemVersion(problem, nextVersionNumber) {
      const existing = problems.get(problem.slug);
      existing.versions.push({
        versionNumber: nextVersionNumber,
        contentDigest: problem.contentDigest,
        title: problem.title,
        statement: problem.statement
      });
    },

    snapshot() {
      return Array.from(problems.values()).map((problem) => ({
        slug: problem.slug,
        versionCount: problem.versions.length,
        latestDigest: problem.versions[problem.versions.length - 1].contentDigest
      }));
    }
  };
}

const FIND_LATEST_IMPORT_SQL = `
SELECT
  pv.version_number AS latest_version_number,
  pva.content_digest AS latest_digest
FROM problem_versions pv
LEFT JOIN problem_version_assets pva
  ON pva.problem_version_id = pv.id
WHERE pv.problem_id = $1
ORDER BY pv.version_number DESC
LIMIT 1
`;

const INSERT_PROBLEM_SQL = `
INSERT INTO problems (id, title, publication_state)
VALUES ($1, $2, $3)
`;

const UPDATE_PROBLEM_SQL = `
UPDATE problems
SET title = $2,
    publication_state = $3
WHERE id = $1
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

const INSERT_PROBLEM_VERSION_ASSET_SQL = `
INSERT INTO problem_version_assets (
  problem_version_id,
  entry_function,
  language,
  visibility,
  time_limit_ms,
  memory_limit_kb,
  starter_code,
  content_digest
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

const INSERT_PROBLEM_TEST_SQL = `
INSERT INTO problem_version_tests (
  problem_version_id,
  test_type,
  position,
  input,
  expected
)
VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
`;

export function createPostgresProblemImportStore(sqlClient) {
  function publicationStateForVisibility(visibility) {
    return visibility === 'public' ? 'published' : 'unpublished';
  }

  function versionIdFor(slug, versionNumber) {
    return `${slug}-v${versionNumber}`;
  }

  async function insertTests(problemVersionId, tests, testType) {
    let position = 0;
    for (const testCase of tests) {
      position += 1;
      await sqlClient.execute(INSERT_PROBLEM_TEST_SQL, [
        problemVersionId,
        testType,
        position,
        testCase.inputJson,
        testCase.expectedJson
      ]);
    }
  }

  return {
    async getLatestImport(slug) {
      const rows = await sqlClient.query(FIND_LATEST_IMPORT_SQL, [slug]);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        slug,
        latestVersionNumber: Number(row.latest_version_number),
        latestDigest: typeof row.latest_digest === 'string' ? row.latest_digest : null
      };
    },

    async insertInitialProblem(problem) {
      const publicationState = publicationStateForVisibility(problem.visibility);
      const problemVersionId = versionIdFor(problem.slug, 1);
      await sqlClient.execute(INSERT_PROBLEM_SQL, [problem.slug, problem.title, publicationState]);
      await sqlClient.execute(INSERT_PROBLEM_VERSION_SQL, [
        problemVersionId,
        problem.slug,
        1,
        problem.title,
        problem.statement,
        publicationState
      ]);
      await sqlClient.execute(INSERT_PROBLEM_VERSION_ASSET_SQL, [
        problemVersionId,
        problem.entryFunction,
        problem.language,
        problem.visibility,
        problem.timeLimitMs,
        problem.memoryLimitKb,
        problem.starterCode,
        problem.contentDigest
      ]);
      await insertTests(problemVersionId, problem.publicTests, 'public');
      await insertTests(problemVersionId, problem.hiddenTests, 'hidden');
    },

    async appendProblemVersion(problem, nextVersionNumber) {
      const publicationState = publicationStateForVisibility(problem.visibility);
      const problemVersionId = versionIdFor(problem.slug, nextVersionNumber);
      await sqlClient.execute(UPDATE_PROBLEM_SQL, [problem.slug, problem.title, publicationState]);
      await sqlClient.execute(INSERT_PROBLEM_VERSION_SQL, [
        problemVersionId,
        problem.slug,
        nextVersionNumber,
        problem.title,
        problem.statement,
        publicationState
      ]);
      await sqlClient.execute(INSERT_PROBLEM_VERSION_ASSET_SQL, [
        problemVersionId,
        problem.entryFunction,
        problem.language,
        problem.visibility,
        problem.timeLimitMs,
        problem.memoryLimitKb,
        problem.starterCode,
        problem.contentDigest
      ]);
      await insertTests(problemVersionId, problem.publicTests, 'public');
      await insertTests(problemVersionId, problem.hiddenTests, 'hidden');
    }
  };
}

export async function importProblemDefinitions(problemDefinitions, store) {
  const summary = {
    createdProblems: 0,
    createdVersions: 0,
    skipped: 0
  };

  for (const problem of problemDefinitions) {
    const existing = await store.getLatestImport(problem.slug);
    if (!existing) {
      await store.insertInitialProblem(problem);
      summary.createdProblems += 1;
      summary.createdVersions += 1;
      continue;
    }

    if (existing.latestDigest === problem.contentDigest) {
      summary.skipped += 1;
      continue;
    }

    await store.appendProblemVersion(problem, existing.latestVersionNumber + 1);
    summary.createdVersions += 1;
  }

  return summary;
}

function parseDirArgument(argv) {
  const index = argv.findIndex((token) => token === '--dir');
  if (index < 0 || index === argv.length - 1) {
    return path.join(root, 'data', 'problems');
  }
  return path.resolve(root, argv[index + 1]);
}

export async function runProblemImport({ dir, store }) {
  const definitions = readProblemDefinitions(dir);
  return importProblemDefinitions(definitions, store);
}

export async function main(argv = process.argv.slice(2)) {
  const dir = parseDirArgument(argv);
  const store = createPostgresProblemImportStore(createLocalProblemImportSqlClient());
  const summary = await runProblemImport({ dir, store });
  console.log(
    `Imported problems from ${dir}: createdProblems=${summary.createdProblems}, createdVersions=${summary.createdVersions}, skipped=${summary.skipped}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
