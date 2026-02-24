import test from 'node:test';
import assert from 'node:assert/strict';
import { startWorkerRuntime } from '../../workerRuntime';

test('worker runtime starts, idles with ticks, and stops cleanly', async () => {
  let ticks = 0;
  const logs: string[] = [];

  const runtime = startWorkerRuntime({
    pollIntervalMs: 5,
    onTick: async () => {
      ticks += 1;
    },
    logger: {
      info: (message) => logs.push(message),
      error: (message) => logs.push(message)
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  await runtime.stop();

  assert.ok(ticks > 0);
  assert.ok(logs.includes('worker.runtime.started'));
  assert.ok(logs.includes('worker.runtime.stopped'));
});
