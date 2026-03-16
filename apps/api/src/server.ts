import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { Role } from '@placeholder/domain/src/identity';
import type {
  AdminAnalyticsOverviewView,
  LeaderboardView,
  StatsLeaderboardScope,
  StudentStatsView
} from './stats/StatsRankingService';
import { createApiRequestContext } from './observability/requestContext';
import { createHealthRoutes } from './routes/healthRoutes';
import { createLocalPostgresSqlClient } from './runtime/localPostgresSqlClient';
import { HmacSessionTokenIssuer, resolveSessionToken } from './sessionTokens';
import {
  ApiError,
  createErrorPayload,
  createValidationError,
  mapUnknownError
} from './errorResponses';

export type ReadinessDependency = {
  name: string;
  check: () => Promise<boolean>;
};

export type ApiServerInstance = {
  close: () => Promise<void>;
  port: number;
};

type ReadinessSqlClient = {
  query: <T>(sql: string, params?: readonly unknown[]) => Promise<readonly T[]>;
};

type LocalApiRuntime = {
  auth: {
    login: (input: { email: string; password: string }) => Promise<{
      userId: string;
      token: string;
      roles: readonly Role[];
    }>;
    browserSignIn: (input: {
      email: string;
      password: string;
    }) => Promise<{ code: string; expiresAt: string; email: string; displayName: string }>;
    browserSignUp: (input: {
      email: string;
      displayName: string;
      password: string;
    }) => Promise<{ code: string; expiresAt: string; email: string; displayName: string }>;
    exchangeBrowserCode: (input: {
      code: string;
    }) => Promise<{ accessToken: string; email: string; role: 'student' }>;
  };
  stats: {
    getStudentStats: (userId: string) => Promise<StudentStatsView>;
    getLeaderboard: (scope: StatsLeaderboardScope) => Promise<LeaderboardView>;
    getAdminOverview: () => Promise<AdminAnalyticsOverviewView>;
  };
  persistence: {
    problemAdmin: {
      create: (input: {
        problemId: string;
        versionId: string;
        title: string;
        statement: string;
      }) => Promise<unknown>;
      update: (input: {
        problemId: string;
        versionId: string;
        title: string;
        statement: string;
      }) => Promise<unknown>;
    };
    problemPublication: {
      publish: (problemId: string) => Promise<unknown>;
    };
    studentProblemQuery: {
      listPublishedProblems: () => Promise<
        readonly {
          problemId: string;
          title: string;
        }[]
      >;
      getPublishedProblemDetail: (problemId: string) => Promise<{
        problemId: string;
        versionId: string;
        title: string;
        statementMarkdown: string;
        entryFunction: string;
        language: string;
        starterCode: string;
        timeLimitMs: number;
        memoryLimitKb: number;
        examples: readonly {
          input: unknown;
          output: unknown;
        }[];
        publicTests: readonly {
          input: unknown;
          output: unknown;
        }[];
      }>;
    };
    favorites: {
      favorite: (userId: string, problemId: string) => Promise<readonly string[]>;
      list: (userId: string) => Promise<readonly string[]>;
    };
    reviews: {
      submitReview: (input: {
        userId: string;
        problemId: string;
        sentiment: 'like' | 'dislike';
        content: string;
      }) => Promise<unknown>;
      listReviews: (problemId: string) => Promise<
        readonly {
          userId: string;
          problemId: string;
          sentiment: string;
          content: string;
          createdAt: string;
          updatedAt: string;
        }[]
      >;
    };
    submissionStudent: {
      create: (input: {
        submissionId: string;
        actorUserId: string;
        actorRoles: readonly Role[];
        problemId: string;
        language: string;
        sourceCode: string;
      }) => Promise<{
        id: string;
        ownerUserId: string;
        problemVersionId: string;
        status: string;
      }>;
    };
    submissionResults: {
      getBySubmissionId: (submissionId: string) => Promise<{
        submissionId: string;
        ownerUserId: string;
        status: string;
        submittedAt: string;
        failureReason?: string;
        verdict?: string;
        timeMs?: number;
        memoryKb?: number;
      }>;
      listByActorUserId: (actorUserId: string) => Promise<
        readonly {
          submissionId: string;
          ownerUserId: string;
          status: string;
          submittedAt: string;
          failureReason?: string;
          verdict?: string;
          timeMs?: number;
          memoryKb?: number;
        }[]
      >;
    };
  };
};

type AuthenticatedActor = {
  userId: string;
  role: 'admin' | 'student';
};

type AuthorizationResolution =
  | { kind: 'authenticated'; actor: AuthenticatedActor }
  | { kind: 'missing' }
  | { kind: 'invalid' };

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(html);
}

function sendError(response: ServerResponse, error: ApiError): void {
  sendJson(response, error.statusCode, createErrorPayload(error));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Uint8Array);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) {
    return {};
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readFormBody(request: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Uint8Array);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  const params = new URLSearchParams(raw);
  return Object.fromEntries(Array.from(params.entries()));
}

function resolveActorFromAuthorizationHeader(
  headerValue: string | undefined,
  sessionSecret: string
): AuthorizationResolution {
  if (!headerValue) {
    return { kind: 'missing' };
  }
  if (!headerValue.startsWith('Bearer ')) {
    return { kind: 'invalid' };
  }
  const token = headerValue.slice('Bearer '.length).trim();
  const session = resolveSessionToken(token, sessionSecret);
  if (!session) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'authenticated',
    actor: {
      userId: session.userId,
      role: session.roles.includes('admin' as Role) ? 'admin' : 'student'
    }
  };
}

function requireAuthenticatedActor(resolution: AuthorizationResolution): AuthenticatedActor {
  if (resolution.kind === 'authenticated') {
    return resolution.actor;
  }

  if (resolution.kind === 'missing') {
    throw new ApiError(401, 'AUTH_MISSING_TOKEN', 'Authentication token is required');
  }

  throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'Authentication token is invalid');
}

function ensureRole(actor: AuthenticatedActor, role: 'admin' | 'student'): void {
  if (actor.role !== role) {
    throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
  }
}

type SubmissionResultPayload = {
  submissionId: string;
  ownerUserId: string;
  status: string;
  submittedAt: string;
  failureReason?: string;
  verdict?: string;
  timeMs?: number;
  memoryKb?: number;
};

function toSubmissionPayload(
  view: SubmissionResultPayload,
  options?: { includeSubmittedAt?: boolean }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    submissionId: view.submissionId,
    ownerUserId: view.ownerUserId,
    status: view.status
  };

  if (options?.includeSubmittedAt !== false) {
    payload.submittedAt = view.submittedAt;
  }

  if (view.failureReason !== undefined) {
    payload.failureReason = view.failureReason;
  }

  if (view.verdict !== undefined) {
    payload.verdict = view.verdict;
  }

  if (view.timeMs !== undefined) {
    payload.timeMs = view.timeMs;
  }

  if (view.memoryKb !== undefined) {
    payload.memoryKb = view.memoryKb;
  }

  return payload;
}

async function handleReadiness(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: readonly ReadinessDependency[]
): Promise<void> {
  const context = createApiRequestContext({
    'x-request-id':
      typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined
  });
  const readiness = await createHealthRoutes(dependencies).readiness(context);
  sendJson(response, readiness.status === 'ready' ? 200 : 503, readiness);
}

function createDefaultReadinessDependencies(sqlClient?: ReadinessSqlClient): readonly ReadinessDependency[] {
  if (!sqlClient) {
    return [
      { name: 'postgres', check: async () => true },
      { name: 'queue', check: async () => true }
    ];
  }

  return [
    {
      name: 'postgres',
      check: async () => {
        try {
          await sqlClient.query<{ ready: number }>('SELECT 1 AS ready');
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      name: 'queue',
      check: async () => {
        try {
          await sqlClient.query<{ submission_id: string }>('SELECT submission_id FROM judge_jobs LIMIT 1');
          return true;
        } catch {
          return false;
        }
      }
    }
  ];
}

function createLocalApiRuntime(): LocalApiRuntime {
  // Load workspace-bound adapters only when the local Postgres runtime is enabled.
  const { PasswordCredentialAuthService } = require('@placeholder/application/src/auth/PasswordCredentialAuthService') as typeof import('@placeholder/application/src/auth/PasswordCredentialAuthService');
  const { PostgresCredentialRepository } = require('@placeholder/infrastructure/src/postgres/identity/PostgresCredentialRepository') as typeof import('@placeholder/infrastructure/src/postgres/identity/PostgresCredentialRepository');
  const { BrowserStudentAuthService, InMemoryBrowserAuthCodeStore, PostgresStudentAuthUserRepository } = require('./studentAuth/BrowserStudentAuthService') as typeof import('./studentAuth/BrowserStudentAuthService');
  const { PostgresStatsRankingRepository, StatsRankingService } = require('./stats/StatsRankingService') as typeof import('./stats/StatsRankingService');
  const { createLocalPersistenceServices } = require('./runtime/localPersistenceWiring') as typeof import('./runtime/localPersistenceWiring');
  const sqlClient = createLocalPostgresSqlClient();
  const sessionSecret = process.env.JWT_SECRET?.trim() || 'local-dev-jwt-secret';
  const tokenIssuer = new HmacSessionTokenIssuer(sessionSecret);
  const authService = new PasswordCredentialAuthService(
    new PostgresCredentialRepository(sqlClient),
    tokenIssuer
  );
  const browserAuthService = new BrowserStudentAuthService(
    new PostgresStudentAuthUserRepository(sqlClient),
    tokenIssuer,
    new InMemoryBrowserAuthCodeStore()
  );
  return {
    auth: {
      login: authService.login.bind(authService),
      browserSignIn: browserAuthService.signIn.bind(browserAuthService),
      browserSignUp: browserAuthService.signUp.bind(browserAuthService),
      exchangeBrowserCode: browserAuthService.exchange.bind(browserAuthService)
    },
    stats: new StatsRankingService(new PostgresStatsRankingRepository(sqlClient)),
    persistence: createLocalPersistenceServices({
      mode: 'postgres',
      sqlClients: {
        problemClient: sqlClient,
        favoritesClient: sqlClient,
        reviewsClient: sqlClient,
        submissionClient: sqlClient,
        resultClient: sqlClient,
        judgeQueueClient: sqlClient
      }
    })
  };
}

function missingFieldDetail(field: string): { field: string; code: string; message: string } {
  return {
    field,
    code: 'REQUIRED',
    message: `${field} is required`
  };
}

export function createApiRequestHandler(
  dependencies: readonly ReadinessDependency[],
  localRuntime?: LocalApiRuntime
): (request: IncomingMessage, response: ServerResponse) => void | Promise<void> {
  const sessionSecret = process.env.JWT_SECRET?.trim() || 'local-dev-jwt-secret';
  const {
    renderStudentAuthForm,
    renderStudentAuthSuccess,
    renderStudentAuthCallbackRedirect,
    resolveStudentAuthCallback
  } = require('./studentAuth/browserPages') as typeof import('./studentAuth/browserPages');

  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = url.pathname;
    const method = request.method ?? 'GET';

    if (path === '/healthz' && method === 'GET') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (path === '/readyz' && method === 'GET') {
      await handleReadiness(request, response, dependencies);
      return;
    }

    if (!localRuntime) {
      sendError(response, new ApiError(404, 'NOT_FOUND', 'Not Found'));
      return;
    }

    const { persistence } = localRuntime;

    if ((path === '/me/stats' || path === '/stats') && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'student');
        sendJson(response, 200, await localRuntime.stats.getStudentStats(actor.userId));
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const leaderboardMatch = path.match(/^\/leaderboards\/(all-time|weekly|monthly|streak)$/);
    if (leaderboardMatch && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'student');
        sendJson(
          response,
          200,
          await localRuntime.stats.getLeaderboard(leaderboardMatch[1] as StatsLeaderboardScope)
        );
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/ranking' && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'student');
        sendJson(response, 200, await localRuntime.stats.getLeaderboard('all-time'));
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/auth/sign-in' && method === 'GET') {
      try {
        const callback = resolveStudentAuthCallback({
          callbackUri: url.searchParams.get('callback_uri'),
          ojState: url.searchParams.get('oj_state')
        });
        sendHtml(
          response,
          200,
          renderStudentAuthForm({
            mode: 'sign-in',
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
      } catch (error) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-in',
            errorMessage: error instanceof Error ? error.message : 'Invalid browser callback target.'
          })
        );
      }
      return;
    }

    if (path === '/auth/sign-up' && method === 'GET') {
      try {
        const callback = resolveStudentAuthCallback({
          callbackUri: url.searchParams.get('callback_uri'),
          ojState: url.searchParams.get('oj_state')
        });
        sendHtml(
          response,
          200,
          renderStudentAuthForm({
            mode: 'sign-up',
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
      } catch (error) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-up',
            errorMessage: error instanceof Error ? error.message : 'Invalid browser callback target.'
          })
        );
      }
      return;
    }

    if (path === '/auth/sign-in' && method === 'POST') {
      const form = await readFormBody(request);
      const email = String(form.email ?? '').trim();
      const password = String(form.password ?? '').trim();
      let callback:
        | {
            callbackUri: string;
            ojState: string;
          }
        | null;

      try {
        callback = resolveStudentAuthCallback({
          callbackUri: String(form.callbackUri ?? ''),
          ojState: String(form.oj_state ?? '')
        });
      } catch (error) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-in',
            errorMessage: error instanceof Error ? error.message : 'Invalid browser callback target.',
            values: { email }
          })
        );
        return;
      }

      if (!email || !password) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-in',
            errorMessage: !email ? 'Email is required.' : 'Password is required.',
            values: { email },
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
        return;
      }

      try {
        const handoff = await requireAuth(localRuntime).browserSignIn({ email, password });
        const successHtml = callback
          ? renderStudentAuthCallbackRedirect({
              mode: 'sign-in',
              email: handoff.email,
              code: handoff.code,
              expiresAt: handoff.expiresAt,
              callbackUri: callback.callbackUri,
              ojState: callback.ojState
            })
          : renderStudentAuthSuccess({
              mode: 'sign-in',
              email: handoff.email,
              code: handoff.code,
              expiresAt: handoff.expiresAt
            });
        sendHtml(response, 200, successHtml);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to sign in.';
        const statusCode =
          error instanceof Error && error.message.includes('disabled')
            ? 403
            : error instanceof Error && error.message.includes('Administrators must use Web Admin')
              ? 403
              : 401;
        sendHtml(
          response,
          statusCode,
          renderStudentAuthForm({
            mode: 'sign-in',
            errorMessage: message,
            values: { email },
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
      }
      return;
    }

    if (path === '/auth/sign-up' && method === 'POST') {
      const form = await readFormBody(request);
      const email = String(form.email ?? '').trim();
      const displayName = String(form.displayName ?? '').trim();
      const password = String(form.password ?? '').trim();
      const confirmPassword = String(form.confirmPassword ?? '').trim();
      let callback:
        | {
            callbackUri: string;
            ojState: string;
          }
        | null;

      try {
        callback = resolveStudentAuthCallback({
          callbackUri: String(form.callbackUri ?? ''),
          ojState: String(form.oj_state ?? '')
        });
      } catch (error) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-up',
            errorMessage: error instanceof Error ? error.message : 'Invalid browser callback target.',
            values: { email, displayName }
          })
        );
        return;
      }

      if (!email || !displayName || !password || !confirmPassword) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-up',
            errorMessage: 'Email, display name, password, and confirm password are required.',
            values: { email, displayName },
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
        return;
      }

      if (password !== confirmPassword) {
        sendHtml(
          response,
          400,
          renderStudentAuthForm({
            mode: 'sign-up',
            errorMessage: 'Password confirmation does not match.',
            values: { email, displayName },
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
        return;
      }

      try {
        const handoff = await requireAuth(localRuntime).browserSignUp({
          email,
          displayName,
          password
        });
        const successHtml = callback
          ? renderStudentAuthCallbackRedirect({
              mode: 'sign-up',
              email: handoff.email,
              code: handoff.code,
              expiresAt: handoff.expiresAt,
              callbackUri: callback.callbackUri,
              ojState: callback.ojState
            })
          : renderStudentAuthSuccess({
              mode: 'sign-up',
              email: handoff.email,
              code: handoff.code,
              expiresAt: handoff.expiresAt
            });
        sendHtml(response, 200, successHtml);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create account.';
        const statusCode =
          error instanceof Error && error.message.includes('already exists')
            ? 409
            : 400;
        sendHtml(
          response,
          statusCode,
          renderStudentAuthForm({
            mode: 'sign-up',
            errorMessage: message,
            values: { email, displayName },
            callbackUri: callback?.callbackUri,
            ojState: callback?.ojState
          })
        );
      }
      return;
    }

    if (path === '/auth/extension/exchange' && method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const code = String(body.code ?? '').trim();
        if (!code) {
          sendError(
            response,
            createValidationError('invalid exchange payload', [missingFieldDetail('code')])
          );
          return;
        }

        const session = await requireAuth(localRuntime).exchangeBrowserCode({ code });
        sendJson(response, 200, session);
      } catch (error) {
        if (error instanceof Error) {
          sendError(response, new ApiError(401, 'AUTH_INVALID_EXCHANGE_CODE', error.message));
          return;
        }
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const email = String(body.email ?? '').trim();
        const password = String(body.password ?? '').trim();
        const missingFields = [
          !email ? missingFieldDetail('email') : null,
          !password ? missingFieldDetail('password') : null
        ].filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        if (missingFields.length > 0) {
          sendError(
            response,
            createValidationError('invalid login payload', missingFields)
          );
          return;
        }

        const session = await requireAuth(localRuntime).login({ email, password });
        sendJson(response, 200, {
          accessToken: session.token,
          role: session.roles.includes('admin' as Role) ? 'admin' : 'student'
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Authentication failed') {
          sendError(response, new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'invalid credentials'));
          return;
        }

        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/problems' && method === 'POST') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'admin');
        const body = await readJsonBody(request);
        const problemId = String(body.problemId ?? '');
        const versionId = String(body.versionId ?? '');
        const title = String(body.title ?? '');
        const statement = String(body.statement ?? '');
        const missingFields = [
          !problemId ? missingFieldDetail('problemId') : null,
          !versionId ? missingFieldDetail('versionId') : null,
          !title ? missingFieldDetail('title') : null,
          !statement ? missingFieldDetail('statement') : null
        ].filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        if (missingFields.length > 0) {
          sendError(
            response,
            createValidationError('invalid problem payload', missingFields)
          );
          return;
        }

        await persistence.problemAdmin.create({
          problemId,
          versionId,
          title,
          statement
        });
        await persistence.problemPublication.publish(problemId);
        sendJson(response, 201, { problemId });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/admin/problems' && method === 'POST') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'admin');
        const body = await readJsonBody(request);
        const problemId = String(body.problemId ?? '');
        const versionId = String(body.versionId ?? '');
        const title = String(body.title ?? '');
        const statement = String(body.statement ?? '');
        const missingFields = [
          !problemId ? missingFieldDetail('problemId') : null,
          !versionId ? missingFieldDetail('versionId') : null,
          !title ? missingFieldDetail('title') : null,
          !statement ? missingFieldDetail('statement') : null
        ].filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        if (missingFields.length > 0) {
          sendError(
            response,
            createValidationError('invalid problem payload', missingFields)
          );
          return;
        }

        await persistence.problemAdmin.create({
          problemId,
          versionId,
          title,
          statement
        });
        sendJson(response, 201, { problemId });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const adminProblemUpdateMatch = path.match(/^\/admin\/problems\/([^/]+)$/);
    if (adminProblemUpdateMatch && method === 'PUT') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'admin');
        const body = await readJsonBody(request);
        const versionId = String(body.versionId ?? '');
        const title = String(body.title ?? '');
        const statement = String(body.statement ?? '');
        const missingFields = [
          !versionId ? missingFieldDetail('versionId') : null,
          !title ? missingFieldDetail('title') : null,
          !statement ? missingFieldDetail('statement') : null
        ].filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        if (missingFields.length > 0) {
          sendError(
            response,
            createValidationError('invalid problem update payload', missingFields)
          );
          return;
        }

        await persistence.problemAdmin.update({
          problemId: adminProblemUpdateMatch[1],
          versionId,
          title,
          statement
        });
        sendJson(response, 200, { problemId: adminProblemUpdateMatch[1] });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const adminProblemPublishMatch = path.match(/^\/admin\/problems\/([^/]+)\/publish$/);
    if (adminProblemPublishMatch && method === 'POST') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'admin');
        await persistence.problemPublication.publish(adminProblemPublishMatch[1]);
        sendJson(response, 200, { problemId: adminProblemPublishMatch[1] });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/problems' && method === 'GET') {
      try {
        requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        const problems = await persistence.studentProblemQuery.listPublishedProblems();
        sendJson(response, 200, {
          problems: problems.map((problem) => ({
            problemId: problem.problemId,
            title: problem.title
          }))
        });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const problemDetailMatch = path.match(/^\/problems\/([^/]+)$/);
    if (problemDetailMatch && method === 'GET') {
      try {
        requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        const problem = await persistence.studentProblemQuery.getPublishedProblemDetail(
          problemDetailMatch[1]
        );
        sendJson(response, 200, {
          problemId: problem.problemId,
          versionId: problem.versionId,
          title: problem.title,
          statementMarkdown: problem.statementMarkdown,
          entryFunction: problem.entryFunction,
          language: problem.language,
          starterCode: problem.starterCode,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitKb: problem.memoryLimitKb,
          examples: problem.examples,
          publicTests: problem.publicTests
        });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/submissions' && method === 'POST') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'student');
        const body = await readJsonBody(request);
        const submissionId = String(body.submissionId ?? '');
        const problemId = String(body.problemId ?? '');
        const language = String(body.language ?? '');
        const sourceCode = String(body.sourceCode ?? '');
        const missingFields = [
          !submissionId ? missingFieldDetail('submissionId') : null,
          !problemId ? missingFieldDetail('problemId') : null,
          !language ? missingFieldDetail('language') : null,
          !sourceCode ? missingFieldDetail('sourceCode') : null
        ].filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        if (missingFields.length > 0) {
          sendError(
            response,
            createValidationError('invalid submission payload', missingFields)
          );
          return;
        }

        const record = await persistence.submissionStudent.create({
          submissionId,
          actorUserId: actor.userId,
          actorRoles: ['student' as Role],
          problemId,
          language,
          sourceCode
        });
        sendJson(response, 201, {
          submissionId: record.id,
          status: record.status,
          ownerUserId: record.ownerUserId,
          problemVersionId: record.problemVersionId,
          enqueueAccepted: true
        });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/submissions' && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'student');
        const submissions = await persistence.submissionResults.listByActorUserId(actor.userId);
        sendJson(response, 200, {
          submissions: submissions.map((submission) => toSubmissionPayload(submission))
        });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const submissionResultMatch = path.match(/^\/submissions\/([^/]+)(?:\/result)?$/);
    if (submissionResultMatch && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );

        const view = await persistence.submissionResults.getBySubmissionId(submissionResultMatch[1]);
        if (actor.role === 'student' && view.ownerUserId !== actor.userId) {
          sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
          return;
        }

        sendJson(
          response,
          200,
          actor.role === 'student'
            ? toSubmissionPayload(view)
            : toSubmissionPayload(view, { includeSubmittedAt: false })
        );
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const adminSubmissionMatch = path.match(/^\/admin\/submissions\/([^/]+)$/);
    if (adminSubmissionMatch && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
            sessionSecret
          )
        );
        ensureRole(actor, 'admin');
        const view = await persistence.submissionResults.getBySubmissionId(adminSubmissionMatch[1]);
        sendJson(response, 200, toSubmissionPayload(view, { includeSubmittedAt: false }));
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const favoriteMatch = path.match(/^\/favorites\/([^/]+)$/);
    if (favoriteMatch && method === 'PUT') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        const problemId = favoriteMatch[1];
        await persistence.favorites.favorite(actor.userId, problemId);
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (path === '/favorites' && method === 'GET') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        const favorites = await persistence.favorites.list(actor.userId);
        sendJson(response, 200, { favorites });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const reviewMatch = path.match(/^\/reviews\/([^/]+)$/);
    if (reviewMatch && method === 'PUT') {
      try {
        const actor = requireAuthenticatedActor(
          resolveActorFromAuthorizationHeader(
            typeof request.headers.authorization === 'string'
              ? request.headers.authorization
              : undefined,
            sessionSecret
          )
        );
        const body = await readJsonBody(request);
        const sentiment = String(body.sentiment ?? '');
        const content = String(body.content ?? '');
        if ((sentiment !== 'like' && sentiment !== 'dislike') || content.trim().length === 0) {
          sendError(
            response,
            createValidationError('invalid review payload', [
              ...(sentiment !== 'like' && sentiment !== 'dislike'
                ? [
                    {
                      field: 'sentiment',
                      code: 'INVALID_VALUE',
                      message: 'sentiment must be like or dislike'
                    }
                  ]
                : []),
              ...(content.trim().length === 0
                ? [missingFieldDetail('content')]
                : [])
            ])
          );
          return;
        }
        await persistence.reviews.submitReview({
          userId: actor.userId,
          problemId: reviewMatch[1],
          sentiment,
          content
        });
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    if (reviewMatch && method === 'GET') {
      const reviews = await persistence.reviews.listReviews(reviewMatch[1]);
      sendJson(response, 200, { reviews });
      return;
    }

    sendError(response, new ApiError(404, 'NOT_FOUND', 'Not Found'));
  };
}

function requireAuth(localRuntime: LocalApiRuntime | undefined): LocalApiRuntime['auth'] {
  if (!localRuntime) {
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is unavailable');
  }

  return localRuntime.auth;
}

export async function startApiServer(options?: {
  port?: number;
  host?: string;
  dependencies?: readonly ReadinessDependency[];
}): Promise<ApiServerInstance> {
  const port = options?.port ?? Number(process.env.PORT ?? 3000);
  const host = options?.host ?? '0.0.0.0';
  const sqlClient = process.env.DATABASE_URL ? createLocalPostgresSqlClient() : undefined;
  const dependencies = options?.dependencies ?? createDefaultReadinessDependencies(sqlClient);
  const localRuntime = process.env.DATABASE_URL ? createLocalApiRuntime() : undefined;

  const server = createServer((request, response) => {
    void createApiRequestHandler(dependencies, localRuntime)(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return {
    port: boundPort,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
