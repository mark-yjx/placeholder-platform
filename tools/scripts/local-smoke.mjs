#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';

function runStep(name, command) {
  process.stdout.write(`[smoke] ${name}... `);
  execSync(command, { stdio: 'ignore' });
  console.log('ok');
}

const LOCAL_API_PORT = 3100;
const LOCAL_API_BASE = `http://127.0.0.1:${LOCAL_API_PORT}`;

let apiProcess = null;
let workerProcess = null;

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

function startLocalWorkerProcess() {
  workerProcess = spawn('npm', ['run', 'worker:start'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://oj:oj@127.0.0.1:5432/oj',
      DOCKER_IMAGE_PYTHON: 'python:3.12-alpine'
    }
  });
}

async function stopLocalWorkerProcess() {
  if (!workerProcess) {
    return;
  }
  await new Promise((resolve) => {
    workerProcess.once('exit', () => resolve(undefined));
    workerProcess.kill('SIGTERM');
    setTimeout(() => {
      if (workerProcess && !workerProcess.killed) {
        workerProcess.kill('SIGKILL');
      }
    }, 1500);
  });
  workerProcess = null;
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

  process.stdout.write('[smoke] create problem (admin)... ');
  await apiRequest(
    'POST',
    '/problems',
    {
      problemId,
      versionId: `${problemId}-v1`,
      title: 'Smoke Problem',
      statement: 'Smoke statement'
    },
    adminToken
  );
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

  process.stdout.write('[smoke] submit while worker stopped and verify queued... ');
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
  if (submission.status !== 'queued') {
    throw new Error('submission was not queued');
  }
  const queuedView = await apiRequest('GET', `/submissions/${submissionId}/result`, undefined, studentToken);
  assertSubmissionResult(queuedView, 'queued');
  console.log('ok');

  process.stdout.write('[smoke] start worker and wait for finished result... ');
  startLocalWorkerProcess();
  const finishedView = await waitForSubmissionResult(
    submissionId,
    studentToken,
    'finished',
    'AC',
    40,
    250
  );
  assertSubmissionResult(finishedView, 'finished', 'AC');
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
  console.log('ok');
}

async function main() {
  try {
    runStep('boot local stack', 'npm run local:up');
    runStep('seed user+problem', 'npm run local:db:setup');
    startLocalApiProcess();
    await runFlow();
    await stopLocalWorkerProcess();
    await stopLocalApiProcess();
    console.log('SMOKE PASS');
  } catch (error) {
    await stopLocalWorkerProcess();
    await stopLocalApiProcess();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SMOKE FAIL: ${message}`);
    process.exit(1);
  }
}

void main();
