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
    const client = new HttpAuthClient({ apiBaseUrl: 'http://oj.test' });
    await assert.rejects(
      client.login({ email: 'student@example.com', password: 'wrong' }),
      (error: unknown) => {
        assert.ok(error instanceof ExtensionApiError);
        assert.equal(mapExtensionError(error).userMessage, 'Invalid email or password.');
        return true;
      }
    );
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

    if (path.startsWith('/submissions/') && path.endsWith('/result')) {
      return createJsonResponse({
        submissionId: path.split('/')[2],
        verdict: 'AC',
        timeMs: 120,
        memoryKb: 2048
      });
    }

    return createJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, { status: 404 });
  };

  try {
    const client = new HttpPracticeApiClient({ apiBaseUrl: 'http://oj.test' });

    assert.deepEqual(await client.listPublishedProblems('student-token'), [
      { problemId: 'problem-1', title: 'Two Sum' }
    ]);

    const submission = await client.createSubmission('student-token', {
      problemId: 'problem-1',
      language: 'python',
      sourceCode: 'print(42)'
    });
    assert.match(submission.submissionId, /^[0-9a-f-]{36}$/);

    assert.deepEqual(await client.getSubmissionResult('student-token', submission.submissionId), {
      submissionId: submission.submissionId,
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    });

    assert.deepEqual(seenPaths, [
      'GET /problems',
      'POST /submissions',
      `GET /submissions/${submission.submissionId}/result`
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http engagement client uses live favorites and reviews endpoints', async () => {
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

    return createJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not Found' } }, { status: 404 });
  };

  try {
    const client = new HttpEngagementApiClient({ apiBaseUrl: 'http://oj.test' });
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
    assert.deepEqual(seenPaths, [
      'PUT /favorites/problem-1',
      'DELETE /favorites/problem-1',
      'GET /favorites',
      'PUT /reviews/problem-1'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
