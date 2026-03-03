#!/usr/bin/env node
import { execFileSync, execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy/local/docker-compose.yml');

function runStep(name, command) {
  process.stdout.write(`[smoke] ${name}... `);
  execSync(command, { stdio: 'ignore' });
  console.log('ok');
}

const LOCAL_API_PORT = 3100;
const LOCAL_API_BASE = `http://127.0.0.1:${LOCAL_API_PORT}`;

let apiProcess = null;

function startLocalApiProcess() {
  apiProcess = spawn('npm', ['run', 'api:start'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(LOCAL_API_PORT),
      DATABASE_URL: 'postgresql://oj:oj@127.0.0.1:5432/oj'
    }
  });
}

async function stopLocalApiProcess() {
  if (!apiProcess) {
    return;
  }
  await new Promise((resolve) => {
    apiProcess.once('exit', () => resolve(undefined));
    apiProcess.kill('SIGTERM');
    setTimeout(() => {
      if (apiProcess && !apiProcess.killed) {
        apiProcess.kill('SIGKILL');
      }
    }, 1500);
  });
  apiProcess = null;
}

async function restartLocalApiProcess() {
  await stopLocalApiProcess();
  startLocalApiProcess();
}

async function apiRequest(method, path, body, token) {
  const response = await fetch(`${LOCAL_API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status}`);
  }
  return response.json();
}

async function waitForApiHealthy(attempts, intervalMs) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${LOCAL_API_BASE}/healthz`);
      if (response.ok) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function assertIncludes(list, item, label) {
  if (!Array.isArray(list) || !list.includes(item)) {
    throw new Error(`${label} does not include ${item}`);
  }
}

function assertReviewPresent(reviewsResponse, problemId, label) {
  const reviews = reviewsResponse.reviews ?? [];
  if (!Array.isArray(reviews) || reviews.length === 0) {
    throw new Error(`${label} is empty`);
  }

  const matchingReview = reviews.find(
    (review) =>
      review &&
      review.problemId === problemId &&
      review.userId === 'student-1' &&
      review.sentiment === 'like' &&
      review.content === 'smoke review'
  );

  if (!matchingReview) {
    throw new Error(`${label} missing expected review`);
  }
}

function assertSubmissionResult(view, expectedStatus, expectedVerdict) {
  if (!view || view.status !== expectedStatus) {
    throw new Error(`submission status mismatch: expected ${expectedStatus}`);
  }
  if (expectedVerdict) {
    if (view.verdict !== expectedVerdict) {
      throw new Error(`submission verdict mismatch: expected ${expectedVerdict}`);
    }
    if (typeof view.timeMs !== 'number' || typeof view.memoryKb !== 'number') {
      throw new Error('submission result missing time/memory');
    }
  }
}

async function waitForSubmissionResult(submissionId, token, expectedStatus, expectedVerdict, attempts, intervalMs) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await apiRequest('GET', `/submissions/${submissionId}/result`, undefined, token);
    if (result.status === expectedStatus && (!expectedVerdict || result.verdict === expectedVerdict)) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`submission ${submissionId} did not reach ${expectedStatus}`);
}

function postgresScalar(sql) {
  return execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', 'oj', '-d', 'oj', '-At', '-c', sql],
    { cwd: root, encoding: 'utf8' }
  ).trim();
}

function configureSmokeJudge(problemVersionId) {
  postgresScalar(`
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
VALUES (
  '${problemVersionId}',
  'solve',
  'python',
  'public',
  2000,
  131072,
  E'def solve():\\n    return 42\\n',
  'local-smoke-${problemVersionId}'
)
ON CONFLICT (problem_version_id) DO UPDATE SET
  entry_function = EXCLUDED.entry_function,
  language = EXCLUDED.language,
  visibility = EXCLUDED.visibility,
  time_limit_ms = EXCLUDED.time_limit_ms,
  memory_limit_kb = EXCLUDED.memory_limit_kb,
  starter_code = EXCLUDED.starter_code,
  content_digest = EXCLUDED.content_digest;

INSERT INTO problem_version_tests (problem_version_id, test_type, position, input, expected)
VALUES ('${problemVersionId}', 'public', 1, 'null'::jsonb, '42'::jsonb)
ON CONFLICT (problem_version_id, test_type, position) DO UPDATE SET
  input = EXCLUDED.input,
  expected = EXCLUDED.expected;
`);
}

function createPublishedSmokeProblem(problemId) {
  postgresScalar(`
INSERT INTO problems (id, title, publication_state)
VALUES ('${problemId}', 'Smoke Problem', 'published')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  publication_state = EXCLUDED.publication_state;

INSERT INTO problem_versions (
  id,
  problem_id,
  version_number,
  title,
  statement,
  publication_state
)
VALUES (
  '${problemId}-v1',
  '${problemId}',
  1,
  'Smoke Problem',
  'Smoke statement',
  'published'
)
ON CONFLICT (id) DO NOTHING;
`);
}

function assertSingleTerminalResult(submissionId) {
  const resultCount = Number(
    postgresScalar(`SELECT COUNT(*) FROM judge_results WHERE submission_id = '${submissionId}'`)
  );
  const queuedJobs = Number(
    postgresScalar(`SELECT COUNT(*) FROM judge_jobs WHERE submission_id = '${submissionId}'`)
  );

  if (resultCount !== 1) {
    throw new Error(`expected exactly one judge result for ${submissionId}, found ${resultCount}`);
  }
  if (queuedJobs !== 0) {
    throw new Error(`expected no queued judge job for ${submissionId}, found ${queuedJobs}`);
  }
}

async function runFlow() {
  process.stdout.write('[smoke] wait for API health... ');
  const healthy = await waitForApiHealthy(40, 250);
  if (!healthy) {
    throw new Error('api health timeout');
  }
  console.log('ok');

  process.stdout.write('[smoke] login (fixture token)... ');
  const adminLogin = await apiRequest('POST', '/auth/login', {
    email: 'admin@example.com',
    password: 'ignored'
  });
  const studentLogin = await apiRequest('POST', '/auth/login', {
    email: 'student1@example.com',
    password: 'ignored'
  });
  const adminToken = String(adminLogin.accessToken ?? '');
  const studentToken = String(studentLogin.accessToken ?? '');
  if (!adminToken || !studentToken) {
    throw new Error('login failed');
  }
  console.log('ok');

  const problemId = `smoke-problem-${Date.now()}`;

  process.stdout.write('[smoke] prepare published smoke problem... ');
  createPublishedSmokeProblem(problemId);
  configureSmokeJudge(`${problemId}-v1`);
  console.log('ok');

  process.stdout.write('[smoke] fetch problems (student)... ');
  const problemsBefore = await apiRequest('GET', '/problems', undefined, studentToken);
  const beforeProblemIds = (problemsBefore.problems ?? []).map((item) => item.problemId);
  assertIncludes(beforeProblemIds, problemId, 'problem list');
  console.log('ok');

  process.stdout.write('[smoke] favorite + review (student)... ');
  await apiRequest('PUT', `/favorites/${problemId}`, undefined, studentToken);
  await apiRequest(
    'PUT',
    `/reviews/${problemId}`,
    {
      sentiment: 'like',
      content: 'smoke review'
    },
    studentToken
  );
  const favoritesBefore = await apiRequest('GET', '/favorites', undefined, studentToken);
  const reviewsBefore = await apiRequest('GET', `/reviews/${problemId}`, undefined, studentToken);
  assertIncludes(favoritesBefore.favorites ?? [], problemId, 'favorites');
  assertReviewPresent(reviewsBefore, problemId, 'review list before restart');
  console.log('ok');

  const submissionId = `smoke-submission-${Date.now()}`;

  process.stdout.write('[smoke] submit and wait for compose worker result... ');
  const submission = await apiRequest(
    'POST',
    '/submissions',
    {
      submissionId,
      problemId,
      language: 'python',
      sourceCode: 'print(42)'
    },
    studentToken
  );
  const finishedView = await waitForSubmissionResult(
    submissionId,
    studentToken,
    'finished',
    'AC',
    40,
    250
  );
  assertSubmissionResult(finishedView, 'finished', 'AC');
  assertSingleTerminalResult(submissionId);
  console.log('ok');

  process.stdout.write('[smoke] restart local api runtime... ');
  await restartLocalApiProcess();
  console.log('ok');

  process.stdout.write('[smoke] fetch persisted data after restart... ');
  const healthyAfterRestart = await waitForApiHealthy(40, 250);
  if (!healthyAfterRestart) {
    throw new Error('api health timeout after restart');
  }
  const problemsAfter = await apiRequest('GET', '/problems', undefined, studentToken);
  const favoritesAfter = await apiRequest('GET', '/favorites', undefined, studentToken);
  const reviewsAfter = await apiRequest('GET', `/reviews/${problemId}`, undefined, studentToken);
  const resultAfterRestart = await apiRequest(
    'GET',
    `/submissions/${submissionId}/result`,
    undefined,
    studentToken
  );

  assertIncludes(
    (problemsAfter.problems ?? []).map((item) => item.problemId),
    problemId,
    'problem list after restart'
  );
  assertIncludes(favoritesAfter.favorites ?? [], problemId, 'favorites after restart');
  assertReviewPresent(reviewsAfter, problemId, 'review list after restart');
  assertSubmissionResult(resultAfterRestart, 'finished', 'AC');
  assertSingleTerminalResult(submissionId);
  console.log('ok');
}

async function main() {
  try {
    runStep('boot local stack', 'npm run local:up');
    runStep('seed user+problem', 'npm run local:db:setup');
    startLocalApiProcess();
    await runFlow();
    await stopLocalApiProcess();
    console.log('SMOKE PASS');
  } catch (error) {
    await stopLocalApiProcess();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SMOKE FAIL: ${message}`);
    process.exit(1);
  }
}

void main();
