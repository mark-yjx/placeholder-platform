import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiRequestHandler } from '../server';

function createRuntime() {
  return {
    persistence: {
      problemAdmin: { async create() {} },
      problemPublication: { async publish() {} },
      studentProblemQuery: {
        async listPublishedProblems() { return []; },
        async getPublishedProblemDetail(problemId: string) {
          if (problemId !== 'problem-1') {
            throw new Error('Problem not found');
          }
          return {
            problemId,
            versionId: 'problem-1-v1',
            title: 'Two Sum',
            statement: 'Solve it'
          };
        }
      },
      favorites: {
        async favorite() { return []; },
        async list() { return []; }
      },
      reviews: {
        async submitReview() {},
        async listReviews() { return []; }
      },
      submissionStudent: {
        async create() {
          return {
            id: 'submission-1',
            ownerUserId: 'student-1',
            problemVersionId: 'problem-1-v1',
            status: 'queued'
          };
        }
      },
      submissionResults: {
        async getBySubmissionId(submissionId: string) {
          if (submissionId !== 'submission-1') {
            throw new Error('Submission not found');
          }
          return {
            submissionId,
            ownerUserId: 'student-1',
            status: 'finished'
          };
        }
      }
    }
  };
}

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

test('api errors use unified auth and not-found structure', async () => {
  const invalidLogin = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: { email: 'nobody@example.com', password: 'wrong' },
    runtime: createRuntime()
  });
  assert.equal(invalidLogin.statusCode, 401);
  assert.deepEqual(invalidLogin.body, {
    error: {
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'invalid credentials'
    }
  });

  const notFound = await invoke({ path: '/missing-route' });
  assert.equal(notFound.statusCode, 404);
  assert.deepEqual(notFound.body, {
    error: {
      code: 'NOT_FOUND',
      message: 'Not Found'
    }
  });
});

test('protected endpoints return 401 for missing or invalid tokens and 403 for insufficient role', async () => {
  const missingToken = await invoke({
    path: '/favorites',
    runtime: createRuntime()
  });
  assert.equal(missingToken.statusCode, 401);
  assert.deepEqual(missingToken.body, {
    error: {
      code: 'AUTH_MISSING_TOKEN',
      message: 'Authentication token is required'
    }
  });

  const invalidToken = await invoke({
    path: '/favorites',
    headers: { authorization: 'Bearer not-a-real-token' },
    runtime: createRuntime()
  });
  assert.equal(invalidToken.statusCode, 401);
  assert.deepEqual(invalidToken.body, {
    error: {
      code: 'AUTH_INVALID_TOKEN',
      message: 'Authentication token is invalid'
    }
  });

  const insufficientRole = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: 'Bearer token-student-1' },
    body: {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statement: 'Solve it'
    },
    runtime: createRuntime()
  });
  assert.equal(insufficientRole.statusCode, 403);
  assert.deepEqual(insufficientRole.body, {
    error: {
      code: 'FORBIDDEN',
      message: 'Forbidden'
    }
  });
});

test('missing problem and submission resources return normalized 404 responses', async () => {
  const missingProblem = await invoke({
    path: '/problems/problem-missing',
    headers: { authorization: 'Bearer token-student-1' },
    runtime: createRuntime()
  });
  assert.equal(missingProblem.statusCode, 404);
  assert.deepEqual(missingProblem.body, {
    error: {
      code: 'PROBLEM_NOT_FOUND',
      message: 'Problem not found'
    }
  });

  const missingSubmission = await invoke({
    path: '/submissions/submission-missing/result',
    headers: { authorization: 'Bearer token-admin-1' },
    runtime: createRuntime()
  });
  assert.equal(missingSubmission.statusCode, 404);
  assert.deepEqual(missingSubmission.body, {
    error: {
      code: 'SUBMISSION_NOT_FOUND',
      message: 'Submission not found'
    }
  });
});

test('validation errors expose consistent field-level details', async () => {
  const invalidProblem = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: 'Bearer token-admin-1' },
    body: {
      problemId: 'problem-1'
    },
    runtime: createRuntime()
  });

  assert.equal(invalidProblem.statusCode, 400);
  assert.deepEqual(invalidProblem.body, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'invalid problem payload',
      details: [
        { field: 'versionId', code: 'REQUIRED', message: 'versionId is required' },
        { field: 'title', code: 'REQUIRED', message: 'title is required' },
        { field: 'statement', code: 'REQUIRED', message: 'statement is required' }
      ]
    }
  });
});

test('production errors do not expose raw stack traces', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const failure = await invoke({
      path: '/problems',
      method: 'POST',
      headers: { authorization: 'Bearer token-admin-1' },
      body: {
        problemId: 'problem-1',
        versionId: 'problem-1-v1',
        title: 'Two Sum',
        statement: 'Solve it'
      },
      runtime: {
        persistence: {
          ...createRuntime().persistence,
          problemAdmin: {
            async create() {
              throw { stack: 'sensitive trace' };
            }
          }
        }
      }
    });

    assert.equal(failure.statusCode, 500);
    assert.deepEqual(failure.body, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error'
      }
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
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
        },
        async getPublishedProblemDetail(problemId: string) {
          calls.push(`studentProblemQuery.getPublishedProblemDetail:${problemId}`);
          return {
            problemId,
            versionId: 'problem-1-v1',
            title: 'Two Sum',
            statement: 'Solve it'
          };
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
      },
      submissionResults: {
        async getBySubmissionId(submissionId: string) {
          calls.push(`submissionResults.getBySubmissionId:${submissionId}`);
          return {
            submissionId,
            ownerUserId: 'student-1',
            status: 'finished',
            verdict: 'AC',
            timeMs: 120,
            memoryKb: 2048
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

  const studentProblemDetail = await invoke({
    path: '/problems/problem-1',
    headers: { authorization: 'Bearer token-student-1' },
    runtime
  });
  assert.equal(studentProblemDetail.statusCode, 200);
  assert.deepEqual(studentProblemDetail.body, {
    problemId: 'problem-1',
    versionId: 'problem-1-v1',
    title: 'Two Sum',
    statement: 'Solve it'
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

  const submissionResult = await invoke({
    path: '/submissions/submission-1/result',
    headers: { authorization: 'Bearer token-student-1' },
    runtime
  });
  assert.equal(submissionResult.statusCode, 200);
  assert.deepEqual(submissionResult.body, {
    submissionId: 'submission-1',
    ownerUserId: 'student-1',
    status: 'finished',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(calls, [
    'problemAdmin.create:problem-1',
    'problemPublication.publish:problem-1',
    'studentProblemQuery.listPublishedProblems',
    'studentProblemQuery.getPublishedProblemDetail:problem-1',
    'favorites.favorite:student-1:problem-1',
    'favorites.list:student-1',
    'reviews.submitReview:student-1:problem-1:like',
    'reviews.listReviews:problem-1',
    'submissionStudent.create:submission-1:student-1:problem-1:python',
    'submissionResults.getBySubmissionId:submission-1'
  ]);
});
