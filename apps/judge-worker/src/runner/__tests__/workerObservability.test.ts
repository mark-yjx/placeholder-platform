import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkerLiveness, getWorkerReadiness } from '../../health';
import { WorkerLogEntry, createWorkerLogger } from '../../observability/WorkerLogger';

test('worker logger includes jobId in structured logs', () => {
  const entries: WorkerLogEntry[] = [];
  const logger = createWorkerLogger('job-1', (entry) => {
    entries.push(entry);
  });

  logger.info('processing.started', { attempt: 1 });

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.jobId, 'job-1');
  assert.equal(entries[0]?.service, 'judge-worker');
  assert.equal(entries[0]?.level, 'info');
});

test('worker readiness reports dependency statuses and not_ready state', async () => {
  const liveness = await getWorkerLiveness();
  assert.deepEqual(liveness, { status: 'ok' });

  const readiness = await getWorkerReadiness([
    { name: 'postgres', check: async () => true },
    { name: 'queue', check: async () => false }
  ]);

  assert.equal(readiness.status, 'not_ready');
  assert.deepEqual(readiness.dependencies, [
    { name: 'postgres', status: 'up' },
    { name: 'queue', status: 'down' }
  ]);
});
