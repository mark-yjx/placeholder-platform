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
  restorePracticeState,
  restorePracticeStateOnStartup
} from '../runtime/ExtensionRuntimeBootstrap';
import { LocalPracticeStateStore, MementoLike } from '../runtime/LocalPracticeStateStore';
import { PracticeViewState } from '../ui/PracticeViewState';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

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

class FakeMemento implements MementoLike {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
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

  setSelectedProblem(problemId: string): void {
    this.state.setSelectedProblem(problemId);
  }
}

function createJsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json' }
  });
}

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'vscode-extension', 'src', 'extension.ts'))) {
      return candidate;
    }
  }

  throw new Error('Unable to resolve repository root for extension smoke tests');
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
      new HttpAuthClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 }),
      tokenStore
    );
    const practiceCommands = new PracticeCommands(
      new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 }),
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
        new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 }),
        restoredTokenStore
      ),
      practiceViews: restoredViews,
      output: { appendLine: (value) => outputLines.push(value) }
    });

    assert.deepEqual(restoredViews.state.getProblemNodes(), [
      {
        id: 'problem-1',
        label: 'Two Sum',
        description: 'problem-1',
        detail: '# Two Sum\n\n- Problem ID: problem-1\n\n## Statement\n\nNo statement available.\n'
      }
    ]);
    assert.deepEqual(restoredViews.state.getSubmissionNodes(), [
      {
        id: submission.submissionId,
        label: `${submission.submissionId} | AC | 120ms | 2048KB`,
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
    path.join(resolveRepoRoot(), 'apps', 'vscode-extension', 'src', 'extension.ts'),
    'utf8'
  );

  assert.match(source, /HttpAuthClient/);
  assert.match(source, /HttpPracticeApiClient/);
  assert.match(source, /HttpEngagementApiClient/);
  assert.doesNotMatch(source, /InMemoryAuthClient/);
  assert.doesNotMatch(source, /InMemoryPracticeApiClient/);
  assert.doesNotMatch(source, /InMemoryEngagementApiClient/);
});

test('startup skips practice restore when the API is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch failed');
  };

  try {
    const tokenStore = new SessionTokenStore(
      new FakeSecretStorage({ 'oj.auth.accessToken': 'student-token' })
    );
    await tokenStore.hydrate();

    let restored = false;
    class RecordingPracticeCommands extends PracticeCommands {
      override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
        restored = true;
        return [];
      }

      override async listSubmissions(): Promise<
        readonly {
          submissionId: string;
          status: 'queued' | 'running' | 'finished' | 'failed';
          verdict?: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';
          timeMs?: number;
          memoryKb?: number;
        }[]
      > {
        restored = true;
        return [];
      }
    }

    const outputLines: string[] = [];
    await restorePracticeStateOnStartup({
      apiBaseUrl: 'http://oj.test',
      tokenStore,
      practiceCommands: new RecordingPracticeCommands(
        new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 }),
        tokenStore
      ),
      practiceViews: new RecordingPracticeViews(),
      output: { appendLine: (value) => outputLines.push(value) }
    });

    assert.equal(restored, false);
    assert.ok(outputLines.includes('Session restored from SecretStorage'));
    assert.ok(outputLines.some((line) => line.includes('API health probe failed: fetch failed')));
    assert.ok(
      outputLines.includes(
        'Skipping practice state restore because the API at http://oj.test is unavailable.'
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('startup restores per-problem local state and drops missing file paths', async () => {
  const originalFetch = globalThis.fetch;
  const existingRoot = await mkdtemp(path.join(tmpdir(), 'oj-local-state-'));
  const existingFile = path.join(existingRoot, 'problem-1.py');
  await writeFile(existingFile, 'def solve():\n    return 42\n', 'utf8');

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/healthz')) {
      return createJsonResponse({ status: 'ok' });
    }

    if (url.endsWith('/readyz')) {
      return createJsonResponse({ status: 'ready' });
    }

    if (url.endsWith('/problems') && method === 'GET') {
      return createJsonResponse({
        problems: [{ problemId: 'problem-1', title: 'Two Sum' }]
      });
    }

    if (url.endsWith('/submissions') && method === 'GET') {
      return createJsonResponse({
        submissions: [
          {
            submissionId: 'submission-1',
            status: 'finished',
            verdict: 'AC',
            timeMs: 120,
            memoryKb: 2048
          }
        ]
      });
    }

    throw new Error(`Unhandled request: ${method} ${url}`);
  };

  try {
    const tokenStore = new SessionTokenStore(
      new FakeSecretStorage({ 'oj.auth.accessToken': 'student-token' })
    );
    await tokenStore.hydrate();

    const memento = new FakeMemento();
    const localStateStore = new LocalPracticeStateStore(memento);
    await localStateStore.setSelectedProblemId('problem-1');
    await localStateStore.recordLastOpenedFile('problem-1', existingFile);
    await localStateStore.recordLastSubmission('problem-1', 'submission-1');
    await localStateStore.recordLastOpenedFile('problem-2', '/missing/problem-2.py');

    const practiceViews = new RecordingPracticeViews();
    const outputLines: string[] = [];
    const reopenedFiles: string[] = [];

    await restorePracticeStateOnStartup({
      apiBaseUrl: 'http://oj.test',
      tokenStore,
      practiceCommands: new PracticeCommands(
        new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 }),
        tokenStore
      ),
      practiceViews,
      output: { appendLine: (value) => outputLines.push(value) },
      localStateStore,
      problemStarterWorkspace: {
        openProblemStarter: async () => existingFile,
        reopenProblemStarter: async (filePath) => {
          reopenedFiles.push(filePath);
        }
      }
    });

    assert.equal(practiceViews.state.getSelectedProblemId(), 'problem-1');
    assert.deepEqual(
      practiceViews.state.getProblemNodes(),
      [
        {
          id: 'problem-1',
          label: 'Two Sum',
          description: 'problem-1',
          detail: '# Two Sum\n\n- Problem ID: problem-1\n\n## Statement\n\nNo statement available.\n'
        }
      ]
    );
    assert.deepEqual(
      practiceViews.state.getSubmissionNodes(),
      [
        {
          id: 'submission-1',
          label: 'submission-1 | AC | 120ms | 2048KB',
          description: 'AC | 120ms | 2048KB',
          detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
        }
      ]
    );
    assert.deepEqual(reopenedFiles, [existingFile]);
    assert.ok(
      outputLines.includes(`Restored local workspace file for problem-1: ${existingFile}`)
    );
    assert.ok(
      outputLines.includes(`Reopened starter workspace file for problem-1: ${existingFile}`)
    );
    assert.ok(
      outputLines.includes('Restored last submission for problem-1: submission-1')
    );
    assert.equal(localStateStore.getProblemState('problem-2')?.lastOpenedFilePath, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
