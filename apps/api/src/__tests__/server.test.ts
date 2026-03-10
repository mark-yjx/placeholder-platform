import test from 'node:test';
import assert from 'node:assert/strict';
import type { Role } from '@packages/domain/src/identity';
import { createApiRequestHandler } from '../server';
import { HmacSessionTokenIssuer } from '../sessionTokens';

function createRuntime() {
  const tokenIssuer = new HmacSessionTokenIssuer('local-dev-jwt-secret');
  const issuedBrowserCodes = new Map<string, { accessToken: string; email: string; role: 'student' }>();

  return {
    auth: {
      async login(input: { email: string; password: string }) {
        if (input.email === 'admin@example.com' && input.password === 'ignored') {
          return {
            userId: 'admin-1',
            token: await tokenIssuer.issue({ userId: 'admin-1', roles: ['admin' as Role] }),
            roles: ['admin' as Role] as const
          };
        }

        if (input.email === 'student1@example.com' && input.password === 'secret') {
          return {
            userId: 'student-1',
            token: await tokenIssuer.issue({ userId: 'student-1', roles: ['student' as Role] }),
            roles: ['student' as Role] as const
          };
        }

        throw new Error('Authentication failed');
      },
      async browserSignIn(input: { email: string; password: string }) {
        if (input.email === 'student1@example.com' && input.password === 'secret') {
          const accessToken = await tokenIssuer.issue({
            userId: 'student-1',
            roles: ['student' as Role]
          });
          issuedBrowserCodes.set('SIGNIN1234', {
            accessToken,
            email: 'student1@example.com',
            role: 'student'
          });
          return {
            code: 'SIGNIN1234',
            expiresAt: '2026-03-10T10:00:00.000Z',
            email: 'student1@example.com',
            displayName: 'Student One'
          };
        }

        if (input.email === 'student2@example.com' && input.password === 'secret') {
          throw new Error('This account is disabled. Contact the platform administrator.');
        }

        if (input.email === 'admin@example.com' && input.password === 'ignored') {
          throw new Error('This sign-in is for students only. Administrators must use Web Admin.');
        }

        throw new Error('Invalid email or password.');
      },
      async browserSignUp(input: { email: string; displayName: string; password: string }) {
        if (input.email === 'existing@example.com') {
          throw new Error('An account with that email already exists. Sign in instead.');
        }

        const accessToken = await tokenIssuer.issue({
          userId: 'student-new',
          roles: ['student' as Role]
        });
        issuedBrowserCodes.set('SIGNUP1234', {
          accessToken,
          email: input.email,
          role: 'student'
        });
        return {
          code: 'SIGNUP1234',
          expiresAt: '2026-03-10T10:00:00.000Z',
          email: input.email,
          displayName: input.displayName
        };
      },
      async exchangeBrowserCode(input: { code: string }) {
        const match = issuedBrowserCodes.get(input.code);
        if (!match) {
          throw new Error('That sign-in code is invalid or has already been used.');
        }
        issuedBrowserCodes.delete(input.code);
        return match;
      }
    },
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
            statementMarkdown: 'Solve it',
            entryFunction: 'two_sum',
            language: 'python',
            starterCode: 'def two_sum(nums, target):\n    return 42\n',
            timeLimitMs: 2000,
            memoryLimitKb: 262144,
            examples: [{ input: [2, 7, 11, 15], output: [0, 1] }],
            publicTests: []
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
          if (submissionId === 'submission-failed-1') {
            return {
              submissionId,
              ownerUserId: 'student-1',
              status: 'failed',
              failureReason: 'sandbox could not start'
            };
          }
          if (submissionId !== 'submission-1') {
            throw new Error('Submission not found');
          }
          return {
            submissionId,
            ownerUserId: 'student-1',
            status: 'finished'
          };
        },
        async listByActorUserId(actorUserId: string) {
          return [
            {
              submissionId: 'submission-1',
              ownerUserId: actorUserId,
              status: 'finished',
              verdict: 'AC',
              timeMs: 120,
              memoryKb: 2048
            },
            {
              submissionId: 'submission-older',
              ownerUserId: actorUserId,
              status: 'queued'
            }
          ];
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

async function invokeRaw(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  rawBody?: string;
  runtime?: unknown;
}): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const handler = createApiRequestHandler([
    { name: 'postgres', check: async () => true },
    { name: 'queue', check: async () => true }
  ], options.runtime as never);

  const request = {
    url: options.path,
    method: options.method ?? 'GET',
    headers: options.headers ?? {},
    async *[Symbol.asyncIterator]() {
      if (options.rawBody && options.rawBody.length > 0) {
        yield Buffer.from(options.rawBody);
      }
    }
  };

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
    body: response.body,
    headers: response.headers
  };
}

async function loginAs(
  runtime: unknown,
  request: { email: string; password: string }
): Promise<string> {
  const response = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: request,
    runtime
  });

  assert.equal(response.statusCode, 200);
  const body = response.body as { accessToken: string };
  return body.accessToken;
}

test('/healthz and /readyz are served by api:start runtime', async () => {
  const health = await invoke({ path: '/healthz', headers: { 'x-request-id': 'req-health' } });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.body, { status: 'ok' });

  const readiness = await invoke({ path: '/readyz', headers: { 'x-request-id': 'req-ready' } });
  assert.equal(readiness.statusCode, 200);
  assert.deepEqual(readiness.body, {
    status: 'ready',
    requestId: 'req-ready',
    dependencies: [
      { name: 'postgres', status: 'up' },
      { name: 'queue', status: 'up' }
    ]
  });
});

test('/readyz probes dependencies and returns 503 when a dependency is down', async () => {
  let checks = 0;
  const notReady = await createApiRequestHandler([
    {
      name: 'postgres',
      check: async () => {
        checks += 1;
        return false;
      }
    },
    {
      name: 'queue',
      check: async () => {
        checks += 1;
        return true;
      }
    }
  ], createRuntime() as never);

  const request = createRequest({ path: '/readyz', headers: { 'x-request-id': 'req-not-ready' } });
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

  await notReady(request as never, response as never);
  assert.equal(ended, true);
  assert.equal(checks, 2);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.body), {
    status: 'not_ready',
    requestId: 'req-not-ready',
    dependencies: [
      { name: 'postgres', status: 'down' },
      { name: 'queue', status: 'up' }
    ]
  });
});

test('api errors use unified auth and not-found structure', async () => {
  const missingPassword = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: { email: 'student1@example.com' },
    runtime: createRuntime()
  });
  assert.equal(missingPassword.statusCode, 400);
  assert.deepEqual(missingPassword.body, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'invalid login payload',
      details: [{ field: 'password', code: 'REQUIRED', message: 'password is required' }]
    }
  });

  const invalidLogin = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: { email: 'student1@example.com', password: 'wrong' },
    runtime: createRuntime()
  });
  assert.equal(invalidLogin.statusCode, 401);
  assert.deepEqual(invalidLogin.body, {
    error: {
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'invalid credentials'
    }
  });

  const adminLogin = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: { email: 'admin@example.com', password: 'ignored' },
    runtime: createRuntime()
  });
  assert.equal(adminLogin.statusCode, 200);
  assert.equal((adminLogin.body as { role: string }).role, 'admin');

  const studentLogin = await invoke({
    path: '/auth/login',
    method: 'POST',
    body: { email: 'student1@example.com', password: 'secret' },
    runtime: createRuntime()
  });
  assert.equal(studentLogin.statusCode, 200);
  assert.equal((studentLogin.body as { role: string }).role, 'student');
  assert.notEqual((studentLogin.body as { accessToken: string }).accessToken, 'token-student-1');

  const notFound = await invoke({ path: '/missing-route' });
  assert.equal(notFound.statusCode, 404);
  assert.deepEqual(notFound.body, {
    error: {
      code: 'NOT_FOUND',
      message: 'Not Found'
    }
  });
});

test('student browser auth pages render and complete sign-in/sign-up handoff flows', async () => {
  const runtime = createRuntime();
  const callbackUri = encodeURIComponent('vscode://local.oj-vscode-extension/auth-complete');

  const signInPage = await invokeRaw({
    path: `/auth/sign-in?callback_uri=${callbackUri}&state=signin-state`,
    runtime
  });
  assert.equal(signInPage.statusCode, 200);
  assert.match(signInPage.headers['content-type'], /text\/html/);
  assert.match(signInPage.body, /OJ Practice/);
  assert.match(signInPage.body, /Sign in to continue solving problems in VS Code\./);
  assert.match(signInPage.body, /Don't have an account\?/);
  assert.match(signInPage.body, /name="email"/);
  assert.match(signInPage.body, /name="password"/);
  assert.match(signInPage.body, /name="callbackUri"/);
  assert.match(signInPage.body, /name="state"/);

  const signUpPage = await invokeRaw({
    path: `/auth/sign-up?callback_uri=${callbackUri}&state=signup-state`,
    runtime
  });
  assert.equal(signUpPage.statusCode, 200);
  assert.match(signUpPage.body, /OJ Practice/);
  assert.match(signUpPage.body, /Create your account to start solving problems\./);
  assert.match(signUpPage.body, /Already have an account\?/);
  assert.match(signUpPage.body, /name="displayName"/);
  assert.match(signUpPage.body, /name="confirmPassword"/);

  const signInSuccess = await invokeRaw({
    path: '/auth/sign-in',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: `email=student1%40example.com&password=secret&callbackUri=${callbackUri}&state=signin-state`,
    runtime
  });
  assert.equal(signInSuccess.statusCode, 200);
  assert.match(signInSuccess.body, /Success/);
  assert.match(signInSuccess.body, /Your account is ready\./);
  assert.match(signInSuccess.body, /Returning to VS Code\.\.\./);
  assert.match(signInSuccess.body, /Open VS Code<\/a>/);
  assert.match(signInSuccess.body, /window\.location\.replace/);
  assert.match(signInSuccess.body, /SIGNIN1234/);
  assert.match(
    signInSuccess.body,
    /vscode:\/\/local\.oj-vscode-extension\/auth-complete\?code=SIGNIN1234&amp;state=signin-state/
  );

  const signUpSuccess = await invokeRaw({
    path: '/auth/sign-up',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody:
      `email=newstudent%40example.com&displayName=New%20Student&password=secret&confirmPassword=secret&callbackUri=${callbackUri}&state=signup-state`,
    runtime
  });
  assert.equal(signUpSuccess.statusCode, 200);
  assert.match(signUpSuccess.body, /Success/);
  assert.match(signUpSuccess.body, /Your account is ready\./);
  assert.match(signUpSuccess.body, /Returning to VS Code\.\.\./);
  assert.match(signUpSuccess.body, /Open VS Code<\/a>/);
  assert.match(signUpSuccess.body, /window\.location\.replace/);
  assert.match(signUpSuccess.body, /SIGNUP1234/);
  assert.match(
    signUpSuccess.body,
    /vscode:\/\/local\.oj-vscode-extension\/auth-complete\?code=SIGNUP1234&amp;state=signup-state/
  );
});

test('student browser auth rejects duplicate email, disabled users, and invalid exchange codes cleanly', async () => {
  const runtime = createRuntime();
  const callbackUri = encodeURIComponent('vscode://local.oj-vscode-extension/auth-complete');

  const duplicateSignUp = await invokeRaw({
    path: '/auth/sign-up',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody:
      `email=existing%40example.com&displayName=Existing&password=secret&confirmPassword=secret&callbackUri=${callbackUri}&state=signup-state`,
    runtime
  });
  assert.equal(duplicateSignUp.statusCode, 409);
  assert.match(duplicateSignUp.body, /already exists/i);

  const disabledSignIn = await invokeRaw({
    path: '/auth/sign-in',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: `email=student2%40example.com&password=secret&callbackUri=${callbackUri}&state=signin-state`,
    runtime
  });
  assert.equal(disabledSignIn.statusCode, 403);
  assert.match(disabledSignIn.body, /disabled/i);

  const mismatchSignUp = await invokeRaw({
    path: '/auth/sign-up',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody:
      `email=student3%40example.com&displayName=Mismatch&password=secret&confirmPassword=wrong&callbackUri=${callbackUri}&state=signup-state`,
    runtime
  });
  assert.equal(mismatchSignUp.statusCode, 400);
  assert.match(mismatchSignUp.body, /does not match/i);

  const exchange = await invoke({
    path: '/auth/extension/exchange',
    method: 'POST',
    body: { code: 'NOPE' },
    runtime
  });
  assert.equal(exchange.statusCode, 401);
  assert.deepEqual(exchange.body, {
    error: {
      code: 'AUTH_INVALID_EXCHANGE_CODE',
      message: 'That sign-in code is invalid or has already been used.'
    }
  });
});

test('student browser auth rejects invalid callback configuration cleanly', async () => {
  const runtime = createRuntime();

  const invalidCallbackPage = await invokeRaw({
    path: '/auth/sign-in?callback_uri=https%3A%2F%2Fevil.example%2Fcallback&state=bad-state',
    runtime
  });
  assert.equal(invalidCallbackPage.statusCode, 400);
  assert.match(invalidCallbackPage.body, /callback target is invalid/i);

  const incompleteCallbackSubmit = await invokeRaw({
    path: '/auth/sign-up',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: 'email=student3%40example.com&displayName=Mismatch&password=secret&confirmPassword=secret&callbackUri=vscode%3A%2F%2Flocal.oj-vscode-extension%2Fauth-complete',
    runtime
  });
  assert.equal(incompleteCallbackSubmit.statusCode, 400);
  assert.match(incompleteCallbackSubmit.body, /callback configuration is incomplete/i);
});

test('student browser auth exchange returns a student session token for the extension', async () => {
  const runtime = createRuntime();
  const callbackUri = encodeURIComponent('vscode://local.oj-vscode-extension/auth-complete');
  await invokeRaw({
    path: '/auth/sign-in',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: `email=student1%40example.com&password=secret&callbackUri=${callbackUri}&state=signin-state`,
    runtime
  });

  const exchange = await invoke({
    path: '/auth/extension/exchange',
    method: 'POST',
    body: { code: 'SIGNIN1234' },
    runtime
  });

  assert.equal(exchange.statusCode, 200);
  assert.deepEqual(exchange.body, {
    accessToken: (exchange.body as { accessToken: string }).accessToken,
    email: 'student1@example.com',
    role: 'student'
  });
});

test('protected endpoints return 401 for missing or invalid tokens and 403 for insufficient role', async () => {
  const runtime = createRuntime();
  const missingToken = await invoke({
    path: '/favorites',
    runtime
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
    runtime
  });
  assert.equal(invalidToken.statusCode, 401);
  assert.deepEqual(invalidToken.body, {
    error: {
      code: 'AUTH_INVALID_TOKEN',
      message: 'Authentication token is invalid'
    }
  });

  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });

  const insufficientRole = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: `Bearer ${studentToken}` },
    body: {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statement: 'Solve it'
    },
    runtime
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
  const runtime = createRuntime();
  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });
  const adminToken = await loginAs(runtime, {
    email: 'admin@example.com',
    password: 'ignored'
  });

  const missingProblem = await invoke({
    path: '/problems/problem-missing',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
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
    headers: { authorization: `Bearer ${adminToken}` },
    runtime
  });
  assert.equal(missingSubmission.statusCode, 404);
  assert.deepEqual(missingSubmission.body, {
    error: {
      code: 'SUBMISSION_NOT_FOUND',
      message: 'Submission not found'
    }
  });
});

test('submission list returns deterministic ordering with stable fields', async () => {
  const runtime = createRuntime();
  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });
  const submissions = await invoke({
    path: '/submissions',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });

  assert.equal(submissions.statusCode, 200);
  assert.deepEqual(submissions.body, {
    submissions: [
      {
        submissionId: 'submission-1',
        ownerUserId: 'student-1',
        status: 'finished',
        verdict: 'AC',
        timeMs: 120,
        memoryKb: 2048
      },
      {
        submissionId: 'submission-older',
        ownerUserId: 'student-1',
        status: 'queued'
      }
    ]
  });
});

test('validation errors expose consistent field-level details', async () => {
  const runtime = createRuntime();
  const adminToken = await loginAs(runtime, {
    email: 'admin@example.com',
    password: 'ignored'
  });
  const invalidProblem = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      problemId: 'problem-1'
    },
    runtime
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
    const runtime = createRuntime();
    const adminToken = await loginAs(runtime, {
      email: 'admin@example.com',
      password: 'ignored'
    });
    const failure = await invoke({
      path: '/problems',
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        problemId: 'problem-1',
        versionId: 'problem-1-v1',
        title: 'Two Sum',
        statement: 'Solve it'
      },
      runtime: {
        ...runtime,
        persistence: {
          ...runtime.persistence,
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
    ...createRuntime(),
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
              title: 'Two Sum'
            }
          ];
        },
        async getPublishedProblemDetail(problemId: string) {
          calls.push(`studentProblemQuery.getPublishedProblemDetail:${problemId}`);
          return {
            problemId,
            versionId: 'problem-1-v1',
            title: 'Two Sum',
            statementMarkdown: 'Solve it',
            entryFunction: 'two_sum',
            language: 'python',
            starterCode: 'def two_sum(nums, target):\n    return 42\n',
            timeLimitMs: 2000,
            memoryLimitKb: 262144,
            examples: [{ input: [2, 7, 11, 15], output: [0, 1] }],
            publicTests: []
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
        async listByActorUserId(actorUserId: string) {
          calls.push(`submissionResults.listByActorUserId:${actorUserId}`);
          return [
            {
              submissionId: 'submission-1',
              ownerUserId: actorUserId,
              status: 'finished',
              verdict: 'AC',
              timeMs: 120,
              memoryKb: 2048
            },
            {
              submissionId: 'submission-0',
              ownerUserId: actorUserId,
              status: 'queued'
            }
          ];
        },
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

  const adminToken = await loginAs(runtime, {
    email: 'admin@example.com',
    password: 'ignored'
  });
  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });

  const adminCreate = await invoke({
    path: '/problems',
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
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
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(studentProblems.statusCode, 200);
  assert.deepEqual(studentProblems.body, {
    problems: [
      {
        problemId: 'problem-1',
        title: 'Two Sum'
      }
    ]
  });

  const studentProblemDetail = await invoke({
    path: '/problems/problem-1',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(studentProblemDetail.statusCode, 200);
  assert.deepEqual(studentProblemDetail.body, {
    problemId: 'problem-1',
    versionId: 'problem-1-v1',
    title: 'Two Sum',
    statementMarkdown: 'Solve it',
    entryFunction: 'two_sum',
    language: 'python',
    starterCode: 'def two_sum(nums, target):\n    return 42\n',
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    examples: [{ input: [2, 7, 11, 15], output: [0, 1] }],
    publicTests: []
  });

  const favorite = await invoke({
    path: '/favorites/problem-1',
    method: 'PUT',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(favorite.statusCode, 200);

  const favorites = await invoke({
    path: '/favorites',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.deepEqual(favorites.body, { favorites: ['problem-1'] });

  const review = await invoke({
    path: '/reviews/problem-1',
    method: 'PUT',
    headers: { authorization: `Bearer ${studentToken}` },
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
    headers: { authorization: `Bearer ${studentToken}` },
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

  const studentSubmissionHistory = await invoke({
    path: '/submissions',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(studentSubmissionHistory.statusCode, 200);
  assert.deepEqual(studentSubmissionHistory.body, {
    submissions: [
      {
        submissionId: 'submission-1',
        ownerUserId: 'student-1',
        status: 'finished',
        verdict: 'AC',
        timeMs: 120,
        memoryKb: 2048
      },
      {
        submissionId: 'submission-0',
        ownerUserId: 'student-1',
        status: 'queued'
      }
    ]
  });

  const submissionResult = await invoke({
    path: '/submissions/submission-1',
    headers: { authorization: `Bearer ${studentToken}` },
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

  const submissionResultCompat = await invoke({
    path: '/submissions/submission-1/result',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(submissionResultCompat.statusCode, 200);
  assert.deepEqual(submissionResultCompat.body, {
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
    'submissionResults.listByActorUserId:student-1',
    'submissionResults.getBySubmissionId:submission-1',
    'submissionResults.getBySubmissionId:submission-1'
  ]);
});

test('student problem endpoints whitelist manifest-driven public fields only', async () => {
  const runtime = {
    ...createRuntime(),
    persistence: {
      ...createRuntime().persistence,
      studentProblemQuery: {
        async listPublishedProblems() {
          return [
            {
              problemId: 'collapse',
              title: 'Collapse Identical Digits',
              versionId: 'collapse-v1',
              statement: 'should not leak'
            }
          ] as never;
        },
        async getPublishedProblemDetail(problemId: string) {
          return {
            problemId,
            versionId: 'collapse-v1',
            title: 'Collapse Identical Digits',
            statementMarkdown: '# Statement',
            entryFunction: 'collapse',
            language: 'python',
            starterCode: 'def collapse(number):\n    return number\n',
            timeLimitMs: 2000,
            memoryLimitKb: 262144,
            examples: [{ input: [111], output: 1 }],
            hiddenTests: [{ input: [111], expected: 1 }],
            publicTests: [{ input: [122], output: 12 }]
          } as never;
        }
      }
    }
  };

  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });

  const listResponse = await invoke({
    path: '/problems',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    problems: [
      {
        problemId: 'collapse',
        title: 'Collapse Identical Digits'
      }
    ]
  });

  const detailResponse = await invoke({
    path: '/problems/collapse',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(detailResponse.statusCode, 200);
  assert.deepEqual(detailResponse.body, {
    problemId: 'collapse',
    versionId: 'collapse-v1',
    title: 'Collapse Identical Digits',
    statementMarkdown: '# Statement',
    entryFunction: 'collapse',
    language: 'python',
    starterCode: 'def collapse(number):\n    return number\n',
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    examples: [{ input: [111], output: 1 }],
    publicTests: [{ input: [122], output: 12 }]
  });
  assert.equal('hiddenTests' in (detailResponse.body as Record<string, unknown>), false);
});

test('student submission detail returns failureReason for failed submissions', async () => {
  const runtime = createRuntime();
  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });
  const response = await invoke({
    path: '/submissions/submission-failed-1',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    submissionId: 'submission-failed-1',
    ownerUserId: 'student-1',
    status: 'failed',
    failureReason: 'sandbox could not start'
  });
});

test('student submission payloads omit unavailable metrics but preserve explicit zero values', async () => {
  const runtime = {
    ...createRuntime(),
    persistence: {
      ...createRuntime().persistence,
      submissionResults: {
        async listByActorUserId(actorUserId: string) {
          return [
            {
              submissionId: 'submission-zero',
              ownerUserId: actorUserId,
              status: 'finished',
              verdict: 'AC',
              timeMs: 0,
              memoryKb: 0
            },
            {
              submissionId: 'submission-unavailable',
              ownerUserId: actorUserId,
              status: 'finished',
              verdict: 'CE',
              timeMs: undefined,
              memoryKb: undefined
            }
          ];
        },
        async getBySubmissionId(submissionId: string) {
          if (submissionId === 'submission-zero') {
            return {
              submissionId,
              ownerUserId: 'student-1',
              status: 'finished',
              verdict: 'AC',
              timeMs: 0,
              memoryKb: 0
            };
          }

          if (submissionId === 'submission-unavailable') {
            return {
              submissionId,
              ownerUserId: 'student-1',
              status: 'finished',
              verdict: 'CE',
              timeMs: undefined,
              memoryKb: undefined
            };
          }

          throw new Error('Submission not found');
        }
      }
    }
  };

  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });

  const listResponse = await invoke({
    path: '/submissions',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    submissions: [
      {
        submissionId: 'submission-zero',
        ownerUserId: 'student-1',
        status: 'finished',
        verdict: 'AC',
        timeMs: 0,
        memoryKb: 0
      },
      {
        submissionId: 'submission-unavailable',
        ownerUserId: 'student-1',
        status: 'finished',
        verdict: 'CE'
      }
    ]
  });

  const unavailableDetail = await invoke({
    path: '/submissions/submission-unavailable',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(unavailableDetail.statusCode, 200);
  assert.deepEqual(unavailableDetail.body, {
    submissionId: 'submission-unavailable',
    ownerUserId: 'student-1',
    status: 'finished',
    verdict: 'CE'
  });

  const zeroDetail = await invoke({
    path: '/submissions/submission-zero/result',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(zeroDetail.statusCode, 200);
  assert.deepEqual(zeroDetail.body, {
    submissionId: 'submission-zero',
    ownerUserId: 'student-1',
    status: 'finished',
    verdict: 'AC',
    timeMs: 0,
    memoryKb: 0
  });
});

test('admin submission lookup omits unavailable runtime metrics instead of converting them to zero', async () => {
  const runtime = {
    auth: createRuntime().auth,
    persistence: {
      ...createRuntime().persistence,
      submissionResults: {
        async listByActorUserId() {
          return [];
        },
        async getBySubmissionId(submissionId: string) {
          return {
            submissionId,
            ownerUserId: 'student-1',
            status: 'finished',
            verdict: 'RE',
            timeMs: undefined,
            memoryKb: undefined
          };
        }
      }
    }
  };

  const adminToken = await loginAs(runtime, {
    email: 'admin@example.com',
    password: 'ignored'
  });

  const response = await invoke({
    path: '/admin/submissions/submission-1',
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
    runtime
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    submissionId: 'submission-1',
    ownerUserId: 'student-1',
    status: 'finished',
    verdict: 'RE'
  });
});

test('admin API workflow supports create, update, publish, and submission lookup while rejecting student access', async () => {
  const calls: string[] = [];
  const runtime = {
    auth: createRuntime().auth,
    persistence: {
      problemAdmin: {
        async create(input: {
          problemId: string;
          versionId: string;
          title: string;
          statement: string;
        }) {
          calls.push(`problemAdmin.create:${input.problemId}:${input.versionId}`);
        },
        async update(input: {
          problemId: string;
          versionId: string;
          title: string;
          statement: string;
        }) {
          calls.push(`problemAdmin.update:${input.problemId}:${input.versionId}`);
        }
      },
      problemPublication: {
        async publish(problemId: string) {
          calls.push(`problemPublication.publish:${problemId}`);
        }
      },
      studentProblemQuery: {
        async listPublishedProblems() {
          return [];
        },
        async getPublishedProblemDetail() {
          throw new Error('Problem not found');
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
          throw new Error('not used');
        }
      },
      submissionResults: {
        async listByActorUserId() {
          return [];
        },
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

  const adminToken = await loginAs(runtime, {
    email: 'admin@example.com',
    password: 'ignored'
  });
  const studentToken = await loginAs(runtime, {
    email: 'student1@example.com',
    password: 'secret'
  });

  const adminCreate = await invoke({
    path: '/admin/problems',
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statement: 'Solve it'
    },
    runtime
  });
  assert.equal(adminCreate.statusCode, 201);
  assert.deepEqual(adminCreate.body, { problemId: 'problem-1' });

  const adminUpdate = await invoke({
    path: '/admin/problems/problem-1',
    method: 'PUT',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      versionId: 'problem-1-v2',
      title: 'Two Sum Updated',
      statement: 'Solve it better'
    },
    runtime
  });
  assert.equal(adminUpdate.statusCode, 200);
  assert.deepEqual(adminUpdate.body, { problemId: 'problem-1' });

  const adminPublish = await invoke({
    path: '/admin/problems/problem-1/publish',
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}` },
    runtime
  });
  assert.equal(adminPublish.statusCode, 200);
  assert.deepEqual(adminPublish.body, { problemId: 'problem-1' });

  const adminSubmissionLookup = await invoke({
    path: '/admin/submissions/submission-1',
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
    runtime
  });
  assert.equal(adminSubmissionLookup.statusCode, 200);
  assert.deepEqual(adminSubmissionLookup.body, {
    submissionId: 'submission-1',
    ownerUserId: 'student-1',
    status: 'finished',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  const studentUpdateDenied = await invoke({
    path: '/admin/problems/problem-1',
    method: 'PUT',
    headers: { authorization: `Bearer ${studentToken}` },
    body: {
      versionId: 'problem-1-v3',
      title: 'Nope',
      statement: 'Nope'
    },
    runtime
  });
  assert.equal(studentUpdateDenied.statusCode, 403);
  assert.deepEqual(studentUpdateDenied.body, {
    error: {
      code: 'FORBIDDEN',
      message: 'Forbidden'
    }
  });

  const studentSubmissionLookupDenied = await invoke({
    path: '/admin/submissions/submission-1',
    method: 'GET',
    headers: { authorization: `Bearer ${studentToken}` },
    runtime
  });
  assert.equal(studentSubmissionLookupDenied.statusCode, 403);
  assert.deepEqual(studentSubmissionLookupDenied.body, {
    error: {
      code: 'FORBIDDEN',
      message: 'Forbidden'
    }
  });

  assert.deepEqual(calls, [
    'problemAdmin.create:problem-1:problem-1-v1',
    'problemAdmin.update:problem-1:problem-1-v2',
    'problemPublication.publish:problem-1',
    'submissionResults.getBySubmissionId:submission-1'
  ]);
});
