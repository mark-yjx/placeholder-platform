import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ReadinessDependency = {
  name: string;
  check: () => Promise<boolean>;
};

export type ApiServerInstance = {
  close: () => Promise<void>;
  port: number;
};

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
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

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runPsql(sql: string): string {
  const composeFile = resolveComposeFile();
  const output = execFileSync(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'oj',
      '-d',
      'oj',
      '-At',
      '-F',
      '\t',
      '-c',
      sql
    ],
    { encoding: 'utf8' }
  );
  return output;
}

function resolveComposeFile(): string {
  const candidates = [
    path.resolve(process.cwd(), 'deploy/local/docker-compose.yml'),
    path.resolve(process.cwd(), '../../deploy/local/docker-compose.yml')
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return candidates[0];
}

function runPsqlRows(sql: string): readonly string[][] {
  const output = runPsql(sql).trim();
  if (output.length === 0) {
    return [];
  }
  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'));
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

export function createApiRequestHandler(
  dependencies: readonly ReadinessDependency[],
  useLocalPostgres = false
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

    if (!useLocalPostgres) {
      sendJson(response, 404, { error: 'Not Found' });
      return;
    }

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
      sendJson(response, 401, { error: 'invalid credentials' });
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
        if (!problemId || !versionId || !title || !statement) {
          sendJson(response, 400, { error: 'invalid problem payload' });
          return;
        }

        runPsql(`
          INSERT INTO problems (id, title, publication_state)
          VALUES (${sqlLiteral(problemId)}, ${sqlLiteral(title)}, 'published')
          ON CONFLICT (id) DO UPDATE
          SET title = EXCLUDED.title,
              publication_state = EXCLUDED.publication_state;
        `);
        runPsql(`
          INSERT INTO problem_versions (id, problem_id, version_number, title, statement, publication_state)
          VALUES (
            ${sqlLiteral(versionId)},
            ${sqlLiteral(problemId)},
            1,
            ${sqlLiteral(title)},
            ${sqlLiteral(statement)},
            'published'
          )
          ON CONFLICT (id) DO NOTHING;
        `);
        sendJson(response, 201, { problemId });
      } catch (error) {
        sendJson(response, 403, { error: error instanceof Error ? error.message : 'Forbidden' });
      }
      return;
    }

    if (path === '/problems' && method === 'GET') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendJson(response, 403, { error: 'Forbidden' });
        return;
      }
      const rows = runPsqlRows(`
        SELECT
          p.id,
          pv.id,
          pv.title,
          pv.statement
        FROM problems p
        JOIN LATERAL (
          SELECT id, title, statement, publication_state
          FROM problem_versions
          WHERE problem_id = p.id
          ORDER BY version_number DESC
          LIMIT 1
        ) pv ON true
        WHERE pv.publication_state = 'published'
        ORDER BY p.id ASC
        `);
      sendJson(response, 200, {
        problems: rows.map((row) => ({
          problemId: row[0],
          versionId: row[1],
          title: row[2],
          statement: row[3]
        }))
      });
      return;
    }

    const favoriteMatch = path.match(/^\/favorites\/([^/]+)$/);
    if (favoriteMatch && method === 'PUT') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendJson(response, 403, { error: 'Forbidden' });
        return;
      }
      const problemId = favoriteMatch[1];
      runPsql(`
        INSERT INTO favorites (user_id, problem_id)
        VALUES (${sqlLiteral(actor.userId)}, ${sqlLiteral(problemId)})
        ON CONFLICT (user_id, problem_id) DO NOTHING;
      `);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (path === '/favorites' && method === 'GET') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendJson(response, 403, { error: 'Forbidden' });
        return;
      }
      const rows = runPsqlRows(`
        SELECT problem_id
        FROM favorites
        WHERE user_id = ${sqlLiteral(actor.userId)}
        ORDER BY problem_id ASC
      `);
      sendJson(response, 200, { favorites: rows.map((row) => row[0]) });
      return;
    }

    const reviewMatch = path.match(/^\/reviews\/([^/]+)$/);
    if (reviewMatch && method === 'PUT') {
      const actor = resolveActorFromAuthorizationHeader(
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined
      );
      if (!actor) {
        sendJson(response, 403, { error: 'Forbidden' });
        return;
      }
      const body = await readJsonBody(request);
      const sentiment = String(body.sentiment ?? '');
      const content = String(body.content ?? '');
      if ((sentiment !== 'like' && sentiment !== 'dislike') || content.trim().length === 0) {
        sendJson(response, 400, { error: 'invalid review payload' });
        return;
      }
      runPsql(`
        INSERT INTO reviews (user_id, problem_id, sentiment, content)
        VALUES (
          ${sqlLiteral(actor.userId)},
          ${sqlLiteral(reviewMatch[1])},
          ${sqlLiteral(sentiment)},
          ${sqlLiteral(content)}
        )
        ON CONFLICT (user_id, problem_id) DO UPDATE
        SET sentiment = EXCLUDED.sentiment,
            content = EXCLUDED.content,
            updated_at = NOW();
      `);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (reviewMatch && method === 'GET') {
      const rows = runPsqlRows(`
        SELECT
          user_id,
          problem_id,
          sentiment,
          content
        FROM reviews
        WHERE problem_id = ${sqlLiteral(reviewMatch[1])}
        ORDER BY updated_at DESC, user_id ASC
      `);
      sendJson(response, 200, {
        reviews: rows.map((row) => ({
          userId: row[0],
          problemId: row[1],
          sentiment: row[2],
          content: row[3]
        }))
      });
      return;
    }

    sendJson(response, 404, { error: 'Not Found' });
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
  const useLocalPostgres = Boolean(process.env.DATABASE_URL);

  const server = createServer((request, response) => {
    void createApiRequestHandler(dependencies, useLocalPostgres)(request, response);
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
