#!/usr/bin/env node
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const composeFile = path.join(root, 'deploy/local/docker-compose.yml');
const extensionDistRoot = path.join(root, 'apps', 'vscode-extension', 'dist');
const MISSING_SOLVE_MESSAGE = 'Submission must define a top-level solve() function';
const SOLVE_ONLY_EXTRACTOR = String.raw`
import ast
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    source = handle.read()

try:
    module = ast.parse(source)
except SyntaxError as exc:
    raise SystemExit(str(exc))

lines = source.splitlines()

def slice_source(node):
    segment = ast.get_source_segment(source, node)
    if segment is not None:
        return segment.rstrip() + "\n"
    start = max(getattr(node, "lineno", 1) - 1, 0)
    end = max(getattr(node, "end_lineno", getattr(node, "lineno", 1)), 1)
    return "\n".join(lines[start:end]).rstrip() + "\n"

for node in module.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "solve":
        sys.stdout.write(slice_source(node))
        raise SystemExit(0)

raise SystemExit("Submission must define a top-level solve() function")
`;

let cachedPythonCommand;

function runStep(name, command) {
  process.stdout.write(`[smoke] ${name}... `);
  execSync(command, { stdio: 'ignore' });
  console.log('ok');
}

function resolvePythonCommand() {
  if (cachedPythonCommand !== undefined) {
    return cachedPythonCommand;
  }

  for (const candidate of ['python3', 'python']) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      cachedPythonCommand = candidate;
      return cachedPythonCommand;
    }
  }

  cachedPythonCommand = null;
  return cachedPythonCommand;
}

const LOCAL_API_PORT = 3100;
const LOCAL_API_BASE = `http://127.0.0.1:${LOCAL_API_PORT}`;

let apiProcess = null;

async function restartLocalApiProcess() {
  execFileSync('docker', ['compose', '-f', composeFile, 'restart', 'api'], {
    cwd: root,
    stdio: 'ignore'
  });
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

async function loadExtensionStudentLoop() {
  const [
    { AuthCommands },
    { SessionTokenStore },
    { PracticeCommands },
    { HttpAuthClient, HttpPracticeApiClient }
  ] = await Promise.all([
    import(pathToFileURL(path.join(extensionDistRoot, 'auth', 'AuthCommands.js')).href),
    import(pathToFileURL(path.join(extensionDistRoot, 'auth', 'SessionTokenStore.js')).href),
    import(pathToFileURL(path.join(extensionDistRoot, 'practice', 'PracticeCommands.js')).href),
    import(pathToFileURL(path.join(extensionDistRoot, 'runtime', 'HttpExtensionClients.js')).href)
  ]);

  const tokenStore = new SessionTokenStore();
  const clientConfig = {
    apiBaseUrl: LOCAL_API_BASE,
    requestTimeoutMs: 10_000
  };

  return {
    tokenStore,
    authCommands: new AuthCommands(new HttpAuthClient(clientConfig), tokenStore),
    practiceCommands: new PracticeCommands(new HttpPracticeApiClient(clientConfig), tokenStore)
  };
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

function assertNonCompileErrorVerdict(view) {
  if (!view || view.status !== 'finished') {
    throw new Error('submission did not reach finished state');
  }

  if (!view.verdict || !['AC', 'WA', 'TLE', 'RE'].includes(view.verdict)) {
    throw new Error(`expected non-CE terminal verdict, received ${String(view.verdict)}`);
  }

  if (typeof view.timeMs !== 'number' || typeof view.memoryKb !== 'number') {
    throw new Error('submission result missing time/memory');
  }
}

export function extractSolveOnlyPayload(sourceCode) {
  const trimmedSource = String(sourceCode ?? '').trim();
  if (!trimmedSource) {
    throw new Error('Source code is required');
  }

  const python = resolvePythonCommand();
  if (!python) {
    throw new Error('Python interpreter unavailable for local smoke submission extraction');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-local-smoke-'));
  const scriptPath = path.join(tempDir, 'extract.py');
  const sourcePath = path.join(tempDir, 'submission.py');

  try {
    fs.writeFileSync(scriptPath, SOLVE_ONLY_EXTRACTOR, 'utf8');
    fs.writeFileSync(sourcePath, trimmedSource, 'utf8');

    const result = spawnSync(python, [scriptPath, sourcePath], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (result.status !== 0) {
      const details = result.stderr.trim() || result.stdout.trim() || 'unknown extraction failure';
      throw new Error(details);
    }

    const extractedSourceCode = result.stdout.trimEnd();
    if (!extractedSourceCode) {
      throw new Error('Submission extraction produced no runnable solve() payload');
    }

    return `${extractedSourceCode}\n`;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function assertMissingSolveRejected() {
  try {
    extractSolveOnlyPayload('print(42)\n');
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_SOLVE_MESSAGE) {
      return;
    }
    throw error;
  }

  throw new Error('Expected missing solve() payload to be rejected');
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

async function waitForExtensionSubmissionTerminal(practiceCommands, submissionId, attempts, intervalMs) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await practiceCommands.pollSubmissionResult(submissionId);

    if (result.status === 'finished' || result.status === 'failed') {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`submission ${submissionId} did not reach a terminal state`);
}

function assertWorkerLifecycleLogged(submissionId) {
  const logs = execFileSync(
    'docker',
    ['compose', '-f', composeFile, 'logs', 'worker', '--tail', '200'],
    { cwd: root, encoding: 'utf8' }
  );
  const escapedSubmissionId = submissionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const claimedPattern = new RegExp(
    `message: 'worker\\.job\\.claimed'[\\s\\S]*submissionId: '${escapedSubmissionId}'`
  );
  const runningPattern = new RegExp(
    `message: 'worker\\.submission\\.running'[\\s\\S]*submissionId: '${escapedSubmissionId}'`
  );
  const completedPattern = new RegExp(
    `message: 'worker\\.submission\\.completed'[\\s\\S]*submissionId: '${escapedSubmissionId}'`
  );

  if (!claimedPattern.test(logs)) {
    throw new Error(`worker logs missing claimed event for ${submissionId}`);
  }

  if (!runningPattern.test(logs)) {
    throw new Error(`worker logs missing running event for ${submissionId}`);
  }

  if (!completedPattern.test(logs)) {
    throw new Error(`worker logs missing completed event for ${submissionId}`);
  }
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

  process.stdout.write('[smoke] login through extension http client... ');
  const extensionStudentLoop = await loadExtensionStudentLoop();
  await extensionStudentLoop.authCommands.login({
    email: 'student1@example.com',
    password: 'secret'
  });
  const studentToken = extensionStudentLoop.tokenStore.getAccessToken();
  if (!studentToken) {
    throw new Error('login failed');
  }
  console.log('ok');

  const problemId = `smoke-problem-${Date.now()}`;

  process.stdout.write('[smoke] prepare published smoke problem... ');
  createPublishedSmokeProblem(problemId);
  configureSmokeJudge(`${problemId}-v1`);
  console.log('ok');

  process.stdout.write('[smoke] fetch problems through extension practice client... ');
  const problemsBefore = await extensionStudentLoop.practiceCommands.fetchPublishedProblems();
  const beforeProblemIds = problemsBefore.map((item) => item.problemId);
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

  process.stdout.write('[smoke] reject missing solve() payload... ');
  assertMissingSolveRejected();
  console.log('ok');

  const sourceCode = extractSolveOnlyPayload(`
def solve():
    return 42
`);

  process.stdout.write('[smoke] submit through extension practice client and wait for compose worker result... ');
  const submission = await extensionStudentLoop.practiceCommands.submitCode({
    problemId,
    language: 'python',
    sourceCode
  });
  const submissionId = submission.submissionId;
  const submissionHistoryBeforeTerminal = await extensionStudentLoop.practiceCommands.listSubmissions();
  const queuedOrRunningSubmission = submissionHistoryBeforeTerminal.find(
    (item) => item.submissionId === submissionId
  );
  if (!queuedOrRunningSubmission) {
    throw new Error(`submission ${submissionId} missing from extension submission history`);
  }

  const finishedView = await waitForExtensionSubmissionTerminal(
    extensionStudentLoop.practiceCommands,
    submissionId,
    40,
    250
  );
  if (finishedView.status !== 'finished') {
    throw new Error(`expected finished status for ${submissionId}`);
  }
  assertNonCompileErrorVerdict(finishedView);
  assertWorkerLifecycleLogged(submissionId);
  assertSingleTerminalResult(submissionId);
  console.log('ok');

  process.stdout.write('[smoke] restart compose api service... ');
  await restartLocalApiProcess();
  console.log('ok');

  process.stdout.write('[smoke] fetch persisted data after restart... ');
  const healthyAfterRestart = await waitForApiHealthy(40, 250);
  if (!healthyAfterRestart) {
    throw new Error('api health timeout after restart');
  }
  const restoredExtensionStudentLoop = await loadExtensionStudentLoop();
  await restoredExtensionStudentLoop.authCommands.login({
    email: 'student1@example.com',
    password: 'secret'
  });
  const restoredStudentToken = restoredExtensionStudentLoop.tokenStore.getAccessToken();
  if (!restoredStudentToken) {
    throw new Error('login failed after restart');
  }

  const problemsAfter = await restoredExtensionStudentLoop.practiceCommands.fetchPublishedProblems();
  const favoritesAfter = await apiRequest('GET', '/favorites', undefined, restoredStudentToken);
  const reviewsAfter = await apiRequest('GET', `/reviews/${problemId}`, undefined, restoredStudentToken);
  const resultAfterRestart = await apiRequest(
    'GET',
    `/submissions/${submissionId}/result`,
    undefined,
    restoredStudentToken
  );

  assertIncludes(
    problemsAfter.map((item) => item.problemId),
    problemId,
    'problem list after restart'
  );
  assertIncludes(favoritesAfter.favorites ?? [], problemId, 'favorites after restart');
  assertReviewPresent(reviewsAfter, problemId, 'review list after restart');
  assertNonCompileErrorVerdict(resultAfterRestart);
  assertSingleTerminalResult(submissionId);
  console.log('ok');
}

async function main() {
  try {
    runStep('build extension runtime', 'npm -w oj-vscode-extension run build');
    runStep('boot local stack', 'npm run local:up');
    runStep('seed user+problem', 'npm run local:db:setup');
    runStep('import sample problems', 'npm run import:problems -- --dir data/problems');
    await runFlow();
    console.log('SMOKE PASS');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SMOKE FAIL: ${message}`);
    process.exit(1);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  void main();
}
