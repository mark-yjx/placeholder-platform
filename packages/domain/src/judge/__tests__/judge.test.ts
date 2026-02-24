import test from 'node:test';
import assert from 'node:assert/strict';

import { JudgeResult, ResourceUsage, Verdict } from '../index';

test('Verdict enum allows only AC/WA/TLE/RE/CE', () => {
  assert.deepEqual(
    Object.values(Verdict),
    [Verdict.AC, Verdict.WA, Verdict.TLE, Verdict.RE, Verdict.CE]
  );
});

test('ResourceUsage rejects negative metrics', () => {
  assert.throws(
    () => ResourceUsage.create({ timeMs: -1, memoryKb: 10 }),
    /timeMs must be non-negative/
  );
  assert.throws(
    () => ResourceUsage.create({ timeMs: 1, memoryKb: -10 }),
    /memoryKb must be non-negative/
  );
});

test('JudgeResult carries verdict with non-negative resource usage', () => {
  const result = JudgeResult.create({
    submissionId: 'submission-1',
    verdict: Verdict.AC,
    resourceUsage: ResourceUsage.create({ timeMs: 12, memoryKb: 2048 })
  });

  assert.equal(result.verdict, Verdict.AC);
  assert.equal(result.resourceUsage.timeMs, 12);
  assert.equal(result.resourceUsage.memoryKb, 2048);
});
