import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { Role } from '@packages/domain/src/identity';
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

type LocalApiRuntime = {
  persistence: {
    problemAdmin: {
      create: (input: {
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
          versionId: string;
          title: string;
          statement: string;
        }[]
      >;
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
        verdict?: string;
        timeMs?: number;
        memoryKb?: number;
      }>;
    };
  };
};

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
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

function resolveActorFromAuthorizationHeader(
  headerValue: string | undefined
): { userId: string; role: 'admin' | 'student' } | null {
  if (!headerValue?.startsWith('Bearer ')) {
    return null;
  }
  const token = headerValue.slice('Bearer '.length).trim();
  if (token === 'token-admin-1') {
    return { userId: 'admin-1', role: 'admin' };
  }
  if (token === 'token-student-1') {
    return { userId: 'student-1', role: 'student' };
  }
  return null;
}

function ensureRole(
  actor: { userId: string; role: 'admin' | 'student' } | null,
  role: 'admin' | 'student'
): asserts actor is { userId: string; role: 'admin' | 'student' } {
  if (!actor || actor.role !== role) {
    throw new Error('Forbidden');
  }
}

async function handleReadiness(
  response: ServerResponse,
  dependencies: readonly ReadinessDependency[]
): Promise<void> {
  const checks: { name: string; status: 'up' | 'down' }[] = [];
  for (const dependency of dependencies) {
    const ok = await dependency.check();
    checks.push({ name: dependency.name, status: ok ? 'up' : 'down' });
  }

  const ready = checks.every((item) => item.status === 'up');
  sendJson(response, ready ? 200 : 503, {
    status: ready ? 'ready' : 'not_ready',
    dependencies: checks
  });
}

function createLocalApiRuntime(): LocalApiRuntime {
  // Load workspace-bound adapters only when the local Postgres runtime is enabled.
  const { createLocalPersistenceServices } = require('./runtime/localPersistenceWiring') as typeof import('./runtime/localPersistenceWiring');
  const { createLocalPostgresSqlClient } = require('./runtime/localPostgresSqlClient') as typeof import('./runtime/localPostgresSqlClient');
  const sqlClient = createLocalPostgresSqlClient();
  return {
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
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = url.pathname;
    const method = request.method ?? 'GET';

    if (path === '/healthz') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (path === '/readyz') {
      await handleReadiness(response, dependencies);
      return;
    }

    if (!localRuntime) {
      sendError(response, new ApiError(404, 'NOT_FOUND', 'Not Found'));
      return;
    }

    const { persistence } = localRuntime;

    if (path === '/auth/login' && method === 'POST') {
      const body = await readJsonBody(request);
      const email = String(body.email ?? '');
      if (email === 'admin@example.com') {
        sendJson(response, 200, { accessToken: 'token-admin-1', role: 'admin' });
        return;
      }
      if (email === 'student1@example.com') {
        sendJson(response, 200, { accessToken: 'token-student-1', role: 'student' });
        return;
      }
      sendError(response, new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'invalid credentials'));
      return;
    }

    if (path === '/problems' && method === 'POST') {
      try {
        const actor = resolveActorFromAuthorizationHeader(
          typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
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

    if (path === '/problems' && method === 'GET') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
        return;
      }
      const problems = await persistence.studentProblemQuery.listPublishedProblems();
      sendJson(response, 200, { problems });
      return;
    }

    if (path === '/submissions' && method === 'POST') {
      try {
        const actor = resolveActorFromAuthorizationHeader(
          typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
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

    const submissionResultMatch = path.match(/^\/submissions\/([^/]+)\/result$/);
    if (submissionResultMatch && method === 'GET') {
      try {
        const actor = resolveActorFromAuthorizationHeader(
          typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
        );
        if (!actor) {
          sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
          return;
        }

        const view = await persistence.submissionResults.getBySubmissionId(submissionResultMatch[1]);
        if (actor.role === 'student' && view.ownerUserId !== actor.userId) {
          sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
          return;
        }

        sendJson(response, 200, view);
      } catch (error) {
        sendError(response, mapUnknownError(error));
      }
      return;
    }

    const favoriteMatch = path.match(/^\/favorites\/([^/]+)$/);
    if (favoriteMatch && method === 'PUT') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
        return;
      }
      const problemId = favoriteMatch[1];
      await persistence.favorites.favorite(actor.userId, problemId);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (path === '/favorites' && method === 'GET') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
        return;
      }
      const favorites = await persistence.favorites.list(actor.userId);
      sendJson(response, 200, { favorites });
      return;
    }

    const reviewMatch = path.match(/^\/reviews\/([^/]+)$/);
    if (reviewMatch && method === 'PUT') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendError(response, new ApiError(403, 'FORBIDDEN', 'Forbidden'));
        return;
      }
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

export async function startApiServer(options?: {
  port?: number;
  host?: string;
  dependencies?: readonly ReadinessDependency[];
}): Promise<ApiServerInstance> {
  const port = options?.port ?? Number(process.env.PORT ?? 3000);
  const host = options?.host ?? '0.0.0.0';
  const dependencies = options?.dependencies ?? [{ name: 'runtime', check: async () => true }];
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
