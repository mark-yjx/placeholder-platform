import { createServer, IncomingMessage, ServerResponse } from 'node:http';

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
  dependencies: readonly ReadinessDependency[]
): (request: IncomingMessage, response: ServerResponse) => void | Promise<void> {
  return async (request, response) => {
    const path = request.url ?? '/';

    if (path === '/healthz') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (path === '/readyz') {
      await handleReadiness(response, dependencies);
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

  const server = createServer((request, response) => {
    void createApiRequestHandler(dependencies)(request, response);
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
