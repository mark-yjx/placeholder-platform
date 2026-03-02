import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore, SecretStorageLike } from '../auth/SessionTokenStore';
import { PracticeCommands } from '../practice/PracticeCommands';
import { HttpAuthClient, HttpPracticeApiClient } from '../runtime/HttpExtensionClients';
import {
  PracticeViewsLike,
  probeApiHealth,
  restorePracticeState
} from '../runtime/ExtensionRuntimeBootstrap';
import { PracticeViewState } from '../ui/PracticeViewState';

class FakeSecretStorage implements SecretStorageLike {
  private readonly storeMap = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.storeMap.set(key, value);
    }
  }

  async get(key: string): Promise<string | undefined> {
    return this.storeMap.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storeMap.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storeMap.delete(key);
  }
}

class RecordingPracticeViews implements PracticeViewsLike {
  readonly state = new PracticeViewState();

  showProblems(problems: readonly { problemId: string; title: string }[]): void {
    this.state.setProblems(problems);
  }

  showSubmissionResult(result: {
    submissionId: string;
    status: 'queued' | 'running' | 'finished' | 'failed';
    verdict?: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';
    timeMs?: number;
    memoryKb?: number;
  }): void {
    this.state.recordSubmissionResult(result);
  }
}

function createJsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json' }
  });
}

test('smoke validates login -> fetch -> submit -> poll -> reload restoration over HTTP clients', async () => {
  const originalFetch = globalThis.fetch;
  const submissionHistory = new Map<string, { status: 'queued' | 'finished'; verdict?: 'AC'; timeMs?: number; memoryKb?: number }>();
  let submissionCounter = 0;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);

    if (url.endsWith('/auth/login')) {
      return createJsonResponse({ accessToken: 'student-token' });
    }

    if (url.endsWith('/healthz')) {
      return createJsonResponse({ status: 'ok' });
    }

    if (url.endsWith('/readyz')) {
      return createJsonResponse({ status: 'ready' });
    }

    assert.equal(headers.get('authorization'), 'Bearer student-token');

    if (url.endsWith('/problems')) {
      return createJsonResponse({
        problems: [{ problemId: 'problem-1', title: 'Two Sum' }]
      });
    }

    if (url.endsWith('/submissions') && method === 'POST') {
      submissionCounter += 1;
      const submissionId = `submission-${submissionCounter}`;
      submissionHistory.set(submissionId, { status: 'queued' });
      return createJsonResponse({ submissionId }, { status: 201 });
    }

    if (url.endsWith('/submissions') && method === 'GET') {
      return createJsonResponse({
        submissions: Array.from(submissionHistory.entries()).map(([submissionId, result]) => ({
          submissionId,
          status: result.status,
          verdict: result.verdict,
          timeMs: result.timeMs,
          memoryKb: result.memoryKb
        }))
      });
    }

    const submissionMatch = url.match(/\/submissions\/([^/]+)$/);
    if (submissionMatch && method === 'GET') {
      const submissionId = submissionMatch[1];
      const existing = submissionHistory.get(submissionId);
      assert.ok(existing);
      if (existing.status === 'queued') {
        submissionHistory.set(submissionId, {
          status: 'finished',
          verdict: 'AC',
          timeMs: 120,
          memoryKb: 2048
        });
        return createJsonResponse({ submissionId, status: 'running' });
      }
      return createJsonResponse({
        submissionId,
        status: 'finished',
        verdict: 'AC',
        timeMs: 120,
        memoryKb: 2048
      });
    }

    throw new Error(`Unhandled request: ${method} ${url}`);
  };

  try {
    const secrets = new FakeSecretStorage();
    const tokenStore = new SessionTokenStore(secrets);
    await tokenStore.hydrate();

    const authCommands = new AuthCommands(
      new HttpAuthClient({ apiBaseUrl: 'http://oj.test' }),
      tokenStore
    );
    const practiceCommands = new PracticeCommands(
      new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test' }),
      tokenStore
    );

    await authCommands.login({ email: 'student1@example.com', password: 'secret' });
    const problems = await practiceCommands.fetchPublishedProblems();
    assert.deepEqual(problems, [{ problemId: 'problem-1', title: 'Two Sum' }]);

    const submission = await practiceCommands.submitCode({
      problemId: 'problem-1',
      language: 'python',
      sourceCode: 'print(42)'
    });
    const running = await practiceCommands.pollSubmissionResult(submission.submissionId);
    assert.deepEqual(running, {
      submissionId: submission.submissionId,
      status: 'running',
      verdict: undefined,
      timeMs: undefined,
      memoryKb: undefined
    });

    const finished = await practiceCommands.pollSubmissionResult(submission.submissionId);
    assert.deepEqual(finished, {
      submissionId: submission.submissionId,
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    });

    const health = await probeApiHealth('http://oj.test');
    assert.deepEqual(health, { healthz: 'ok', readyz: 'ready' });

    const restoredTokenStore = new SessionTokenStore(secrets);
    await restoredTokenStore.hydrate();
    assert.equal(restoredTokenStore.getAccessToken(), 'student-token');

    const restoredViews = new RecordingPracticeViews();
    const outputLines: string[] = [];
    await restorePracticeState({
      tokenStore: restoredTokenStore,
      practiceCommands: new PracticeCommands(
        new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test' }),
        restoredTokenStore
      ),
      practiceViews: restoredViews,
      output: { appendLine: (value) => outputLines.push(value) }
    });

    assert.deepEqual(restoredViews.state.getProblemNodes(), [
      { id: 'problem-1', label: 'Two Sum', description: 'problem-1' }
    ]);
    assert.deepEqual(restoredViews.state.getSubmissionNodes(), [
      {
        id: submission.submissionId,
        label: submission.submissionId,
        description: 'AC | 120ms | 2048KB',
        detail: `Submission ${submission.submissionId}: verdict=AC, time=120ms, memory=2048KB`
      }
    ]);
    assert.ok(
      outputLines.includes('Restored 1 problems and 1 submissions from API')
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extension runtime wiring keeps http clients and no in-memory fallback import', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'extension.ts'),
    'utf8'
  );

  assert.match(source, /HttpAuthClient/);
  assert.match(source, /HttpPracticeApiClient/);
  assert.match(source, /HttpEngagementApiClient/);
  assert.doesNotMatch(source, /InMemoryAuthClient/);
  assert.doesNotMatch(source, /InMemoryPracticeApiClient/);
  assert.doesNotMatch(source, /InMemoryEngagementApiClient/);
});
