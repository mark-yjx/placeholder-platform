import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiRequestHandler } from '../server';

async function invoke(path: string): Promise<{ statusCode: number; body: unknown }> {
  const handler = createApiRequestHandler([
    { name: 'postgres', check: async () => true },
    { name: 'queue', check: async () => true }
  ]);

  const request = { url: path } as { url: string };
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
  const health = await invoke('/healthz');
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.body, { status: 'ok' });

  const readiness = await invoke('/readyz');
  assert.equal(readiness.statusCode, 200);
  assert.deepEqual(readiness.body, {
    status: 'ready',
    dependencies: [
      { name: 'postgres', status: 'up' },
      { name: 'queue', status: 'up' }
    ]
  });
});
