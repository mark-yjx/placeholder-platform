import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpAuthClient,
  HttpEngagementApiClient,
  HttpPracticeApiClient
} from '../runtime/HttpExtensionClients';
import { ExtensionApiError, mapExtensionError } from '../errors/ExtensionErrorMapper';

function createJsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

test('http auth client posts credentials and surfaces invalid login mapping', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://oj.test/auth/login');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, JSON.stringify({ email: 'student@example.com', password: 'wrong' }));

    return createJsonResponse(
      { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'invalid credentials' } },
      { status: 401 }
    );
  };

  try {
    const client = new HttpAuthClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 });
    await assert.rejects(
      client.login({ email: 'student@example.com', password: 'wrong' }),
      (error: unknown) => {
        assert.ok(error instanceof ExtensionApiError);
        assert.equal(
          mapExtensionError(error).userMessage,
          'Invalid email or password. Run Placeholder Practice: Sign In and try again.'
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http auth client exposes browser auth URLs and exchanges one-time codes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://oj.test/auth/extension/exchange');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, JSON.stringify({ code: 'ABC123' }));

    return createJsonResponse({
      accessToken: 'student-token',
      email: 'student@example.com',
      role: 'student'
    });
  };

  try {
    const client = new HttpAuthClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 });
    assert.equal(
      client.getBrowserAuthUrl('sign-in', {
        callbackUri: 'vscode://local.placeholder-extension/auth-complete',
        state: 'sign-in-state'
      }),
      'http://oj.test/auth/sign-in?callback_uri=vscode%3A%2F%2Flocal.placeholder-extension%2Fauth-complete&state=sign-in-state'
    );
    assert.equal(
      client.getBrowserAuthUrl('sign-up', {
        callbackUri: 'vscode://local.placeholder-extension/auth-complete',
        state: 'sign-up-state'
      }),
      'http://oj.test/auth/sign-up?callback_uri=vscode%3A%2F%2Flocal.placeholder-extension%2Fauth-complete&state=sign-up-state'
    );
    assert.deepEqual(await client.exchangeBrowserCode({ code: 'ABC123' }), {
      accessToken: 'student-token',
      email: 'student@example.com',
      role: 'student'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http practice client uses bearer auth for fetch, submit, and result polling', async () => {
  const originalFetch = globalThis.fetch;
  const seenPaths: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const path = url.replace('http://oj.test', '');
    seenPaths.push(`${init?.method ?? 'GET'} ${path}`);

    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer student-token');

    if (path === '/problems') {
      return createJsonResponse({ problems: [{ problemId: 'problem-1', title: 'Two Sum' }] });
    }

    if (path === '/problems/problem-1') {
      return createJsonResponse({
        problemId: 'problem-1',
        versionId: 'problem-1-v1',
        title: 'Two Sum',
        statementMarkdown: 'Solve it',
        starterCode: 'def two_sum():\n    pass\n',
        examples: [{ input: [2, 7, 11, 15], output: [0, 1] }],
        publicTests: [{ input: 1, output: 1 }]
      });
    }

    if (path === '/submissions' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        submissionId: string;
        problemId: string;
        language: string;
        sourceCode: string;
      };
      assert.equal(body.problemId, 'problem-1');
      assert.equal(body.language, 'python');
      assert.equal(body.sourceCode, 'print(42)');
      assert.match(body.submissionId, /^[0-9a-f-]{36}$/);

      return createJsonResponse({ submissionId: body.submissionId }, { status: 201 });
    }

    if (path.startsWith('/submissions/')) {
      return createJsonResponse({
        submissionId: path.split('/')[2],
        status: 'finished',
        submittedAt: '2026-03-10T15:30:45.000Z',
        verdict: 'AC',
        timeMs: 120,
        memoryKb: 2048
      });
    }

    return createJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, { status: 404 });
  };

  try {
    const client = new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 });

    assert.deepEqual(await client.listPublishedProblems('student-token'), [
      { problemId: 'problem-1', title: 'Two Sum' }
    ]);
    assert.deepEqual(await client.getPublishedProblemDetail('student-token', 'problem-1'), {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statementMarkdown: 'Solve it',
      starterCode: 'def two_sum():\n    pass\n',
      examples: [{ input: [2, 7, 11, 15], output: [0, 1] }],
      publicTests: [{ input: 1, output: 1 }]
    });

    const submission = await client.createSubmission('student-token', {
      problemId: 'problem-1',
      language: 'python',
      sourceCode: 'print(42)'
    });
    assert.match(submission.submissionId, /^[0-9a-f-]{36}$/);

    assert.deepEqual(await client.getSubmissionResult('student-token', submission.submissionId), {
      submissionId: submission.submissionId,
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    });

    assert.deepEqual(seenPaths, [
      'GET /problems',
      'GET /problems/problem-1',
      'POST /submissions',
      `GET /submissions/${submission.submissionId}`
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http practice client preserves running submission state without inventing verdict data', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://oj.test/submissions/submission-running-1');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer student-token');

    return createJsonResponse({
      submissionId: 'submission-running-1',
      status: 'running'
    });
  };

  try {
    const client = new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 });
    assert.deepEqual(await client.getSubmissionResult('student-token', 'submission-running-1'), {
      submissionId: 'submission-running-1',
      status: 'running',
      verdict: undefined,
      timeMs: undefined,
      memoryKb: undefined
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http engagement client uses live favorites, reviews, stats, and leaderboard endpoints', async () => {
  const originalFetch = globalThis.fetch;
  const seenPaths: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const path = url.replace('http://oj.test', '');
    seenPaths.push(`${init?.method ?? 'GET'} ${path}`);

    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer student-token');

    if (path === '/favorites/problem-1' && init?.method === 'PUT') {
      return createJsonResponse({ ok: true });
    }

    if (path === '/favorites/problem-1' && init?.method === 'DELETE') {
      return createJsonResponse({ ok: true });
    }

    if (path === '/favorites') {
      return createJsonResponse({ favorites: ['problem-1'] });
    }

    if (path === '/reviews/problem-1' && init?.method === 'PUT') {
      return createJsonResponse({ ok: true });
    }

    if (path === '/reviews/problem-1' && init?.method === 'GET') {
      return createJsonResponse({
        reviews: [
          {
            userId: 'student-1',
            problemId: 'problem-1',
            sentiment: 'like',
            content: 'helpful',
            createdAt: '2026-03-02T00:00:00.000Z'
          }
        ]
      });
    }

    if (path === '/me/stats') {
      return createJsonResponse({
        userId: 'student-1',
        displayName: 'Student One',
        solvedCount: 3,
        solvedByDifficulty: [
          { key: 'easy', count: 1 },
          { key: 'medium', count: 1 },
          { key: 'hard', count: 1 }
        ],
        submissionCount: 6,
        acceptedCount: 4,
        acceptanceRate: 66.7,
        activeDays: 6,
        currentStreak: 2,
        longestStreak: 4,
        languageBreakdown: [{ key: 'python', count: 6 }],
        tagBreakdown: [
          { key: 'array', count: 1 },
          { key: 'graphs', count: 1 }
        ],
        badges: [
          {
            id: 'first_ac',
            title: 'First AC',
            description: 'Earn your first accepted submission.',
            earned: true
          }
        ]
      });
    }

    if (path === '/leaderboards/all-time') {
      return createJsonResponse({
        scope: 'all-time',
        title: 'All-Time Leaderboard',
        formula: 'Ranked by solvedCount desc, acceptedCount desc, submissionCount asc.',
        generatedAt: '2026-03-10T13:00:00.000Z',
        entries: [
          {
            rank: 1,
            userId: 'student-1',
            displayName: 'Student One',
            solvedCount: 3,
            acceptedCount: 4,
            submissionCount: 6,
            currentStreak: 2,
            longestStreak: 4,
            score: 3,
            scoreLabel: 'Solved'
          }
        ]
      });
    }

    return createJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, { status: 404 });
  };

  try {
    const client = new HttpEngagementApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 10_000 });
    await client.addFavorite('student-token', 'problem-1');
    await client.removeFavorite('student-token', 'problem-1');
    assert.deepEqual(await client.listFavorites('student-token'), ['problem-1']);
    assert.deepEqual(
      await client.createReview('student-token', {
        problemId: 'problem-1',
        content: 'helpful',
        sentiment: 'like'
      }),
      {
        reviewId: 'problem-1:like:helpful',
        problemId: 'problem-1',
        content: 'helpful',
        sentiment: 'like'
      }
    );
    assert.deepEqual(await client.getMyStats('student-token'), {
      userId: 'student-1',
      displayName: 'Student One',
      solvedCount: 3,
      solvedByDifficulty: [
        { key: 'easy', count: 1 },
        { key: 'medium', count: 1 },
        { key: 'hard', count: 1 }
      ],
      submissionCount: 6,
      acceptedCount: 4,
      acceptanceRate: 66.7,
      activeDays: 6,
      currentStreak: 2,
      longestStreak: 4,
      languageBreakdown: [{ key: 'python', count: 6 }],
      tagBreakdown: [
        { key: 'array', count: 1 },
        { key: 'graphs', count: 1 }
      ],
      badges: [
        {
          id: 'first_ac',
          title: 'First AC',
          description: 'Earn your first accepted submission.',
          earned: true
        }
      ]
    });
    assert.deepEqual(await client.getLeaderboard('student-token', 'all-time'), {
      scope: 'all-time',
      title: 'All-Time Leaderboard',
      formula: 'Ranked by solvedCount desc, acceptedCount desc, submissionCount asc.',
      generatedAt: '2026-03-10T13:00:00.000Z',
      entries: [
        {
          rank: 1,
          userId: 'student-1',
          displayName: 'Student One',
          solvedCount: 3,
          acceptedCount: 4,
          submissionCount: 6,
          currentStreak: 2,
          longestStreak: 4,
          score: 3,
          scoreLabel: 'Solved'
        }
      ]
    });
    assert.deepEqual(seenPaths, [
      'PUT /favorites/problem-1',
      'DELETE /favorites/problem-1',
      'GET /favorites',
      'PUT /reviews/problem-1',
      'GET /me/stats',
      'GET /leaderboards/all-time'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http practice client surfaces timeout errors with actionable message', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const signal = init?.signal;
    await new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
    return createJsonResponse({});
  };

  try {
    const client = new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test', requestTimeoutMs: 1 });
    await assert.rejects(
      client.listPublishedProblems('student-token'),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error & { code?: string }).code, 'ETIMEDOUT');
        assert.match(
          String((error as Error).message),
          /Request timed out after 1ms\. Check oj\.requestTimeoutMs and try again\./
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
