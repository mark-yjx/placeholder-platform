import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiRequestHandler } from '../server';

function createRequest(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const rawBody = options.body ? JSON.stringify(options.body) : '';

  return {
    url: options.path,
    method: options.method ?? 'GET',
    headers: options.headers ?? {},
    async *[Symbol.asyncIterator]() {
      if (rawBody.length > 0) {
        yield Buffer.from(rawBody);
      }
    }
  };
}

async function invoke(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  runtime?: unknown;
}): Promise<{ statusCode: number; body: unknown }> {
  const handler = createApiRequestHandler([
    { name: 'postgres', check: async () => true },
    { name: 'queue', check: async () => true }
  ], options.runtime as never);

  const request = createRequest(options);
  let ended = false;
  const response = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(value: string) {
      this.body = value;
      ended = true;
    }
  };

  await handler(request as never, response as never);
  assert.equal(ended, true);
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body)
  };
}

test('/healthz and /readyz are served by api:start runtime', async () => {
  const health = await invoke({ path: '/healthz' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.body, { status: 'ok' });

  const readiness = await invoke({ path: '/readyz' });
  assert.equal(readiness.statusCode, 200);
  assert.deepEqual(readiness.body, {
    status: 'ready',
    dependencies: [
      { name: 'postgres', status: 'up' },
      { name: 'queue', status: 'up' }
    ]
  });
});

test('local runtime routes problem, favorites, and reviews through injected persistence services', async () => {
  const calls: string[] = [];
  const runtime = {
    persistence: {
      problemAdmin: {
        async create(input: { problemId: string }) {
          calls.push(`problemAdmin.create:${input.problemId}`);
          return { id: input.problemId };
        }
      },
      problemPublication: {
        async publish(problemId: string) {
          calls.push(`problemPublication.publish:${problemId}`);
          return { id: problemId };
        }
      },
      studentProblemQuery: {
        async listPublishedProblems() {
          calls.push('studentProblemQuery.listPublishedProblems');
          return [
            {
              problemId: 'problem-1',
              versionId: 'problem-1-v1',
              title: 'Two Sum',
              statement: 'Solve it'
            }
          ];
        }
      },
      problemVersionHistory: {},
      favorites: {
        async favorite(userId: string, problemId: string) {
          calls.push(`favorites.favorite:${userId}:${problemId}`);
          return [problemId];
        },
        async list(userId: string) {
          calls.push(`favorites.list:${userId}`);
          return ['problem-1'];
        }
      },
      reviews: {
        async submitReview(input: { userId: string; problemId: string; sentiment: string }) {
          calls.push(`reviews.submitReview:${input.userId}:${input.problemId}:${input.sentiment}`);
          return [];
        },
        async listReviews(problemId: string) {
          calls.push(`reviews.listReviews:${problemId}`);
          return [
            {
              userId: 'student-1',
              problemId,
              sentiment: 'like',
              content: 'helpful',
              createdAt: '2026-02-25T00:00:00.000Z',
              updatedAt: '2026-02-25T00:00:00.000Z'
            }
          ];
        }
      },
      submissionStudent: {
        async create(input: {
          submissionId: string;
          actorUserId: string;
          problemId: string;
          language: string;
        }) {
          calls.push(
            `submissionStudent.create:${input.submissionId}:${input.actorUserId}:${input.problemId}:${input.language}`
          );
          return {
            id: input.submissionId,
            ownerUserId: input.actorUserId,
            problemVersionId: 'problem-1-v1',
            status: 'queued'
          };
        }
      }
    }
  };

  const adminCreate = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: 'Bearer token-admin-1' },
    body: {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statement: 'Solve it'
    },
    runtime
  });
  assert.equal(adminCreate.statusCode, 201);

  const studentProblems = await invoke({
    path: '/problems',
    headers: { authorization: 'Bearer token-student-1' },
    runtime
  });
  assert.equal(studentProblems.statusCode, 200);
  assert.deepEqual(studentProblems.body, {
    problems: [
      {
        problemId: 'problem-1',
        versionId: 'problem-1-v1',
        title: 'Two Sum',
        statement: 'Solve it'
      }
    ]
  });

  const favorite = await invoke({
    path: '/favorites/problem-1',
    method: 'PUT',
    headers: { authorization: 'Bearer token-student-1' },
    runtime
  });
  assert.equal(favorite.statusCode, 200);

  const favorites = await invoke({
    path: '/favorites',
    headers: { authorization: 'Bearer token-student-1' },
    runtime
  });
  assert.deepEqual(favorites.body, { favorites: ['problem-1'] });

  const review = await invoke({
    path: '/reviews/problem-1',
    method: 'PUT',
    headers: { authorization: 'Bearer token-student-1' },
    body: { sentiment: 'like', content: 'helpful' },
    runtime
  });
  assert.equal(review.statusCode, 200);

  const reviews = await invoke({
    path: '/reviews/problem-1',
    runtime
  });
  assert.deepEqual(reviews.body, {
    reviews: [
      {
        userId: 'student-1',
        problemId: 'problem-1',
        sentiment: 'like',
        content: 'helpful',
        createdAt: '2026-02-25T00:00:00.000Z',
        updatedAt: '2026-02-25T00:00:00.000Z'
      }
    ]
  });

  const submission = await invoke({
    path: '/submissions',
    method: 'POST',
    headers: { authorization: 'Bearer token-student-1' },
    body: {
      submissionId: 'submission-1',
      problemId: 'problem-1',
      language: 'python',
      sourceCode: 'print(42)'
    },
    runtime
  });
  assert.equal(submission.statusCode, 201);
  assert.deepEqual(submission.body, {
    submissionId: 'submission-1',
    status: 'queued',
    ownerUserId: 'student-1',
    problemVersionId: 'problem-1-v1',
    enqueueAccepted: true
  });

  assert.deepEqual(calls, [
    'problemAdmin.create:problem-1',
    'problemPublication.publish:problem-1',
    'studentProblemQuery.listPublishedProblems',
    'favorites.favorite:student-1:problem-1',
    'favorites.list:student-1',
    'reviews.submitReview:student-1:problem-1:like',
    'reviews.listReviews:problem-1',
    'submissionStudent.create:submission-1:student-1:problem-1:python'
  ]);
});
