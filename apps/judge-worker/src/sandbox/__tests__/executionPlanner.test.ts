import test from 'node:test';
import assert from 'node:assert/strict';

import { ExecutionPlanner } from '../ExecutionPlanner';
import { InMemoryProblemExecutionConfigRepository } from '../problemConfig';

test('execution planner uses default limits when no override exists', async () => {
  const config = new InMemoryProblemExecutionConfigRepository();
  const planner = new ExecutionPlanner(config);

  const plan = await planner.plan({
    submissionId: 'submission-1',
    ownerUserId: 'user-1',
    problemId: 'problem-default',
    problemVersionId: 'version-1',
    language: 'python',
    sourceCode: 'print("ok")'
  });

  assert.deepEqual(plan.limits, {
    cpuCores: 1,
    memoryMb: 256,
    timeMs: 2000
  });
});

test('execution planner applies per-problem override limits', async () => {
  const config = new InMemoryProblemExecutionConfigRepository();
  config.setOverride('problem-override', { cpuCores: 2, memoryMb: 512, timeMs: 4000 });
  const planner = new ExecutionPlanner(config);

  const plan = await planner.plan({
    submissionId: 'submission-2',
    ownerUserId: 'user-2',
    problemId: 'problem-override',
    problemVersionId: 'version-2',
    language: 'python',
    sourceCode: 'print("override")'
  });

  assert.deepEqual(plan.limits, {
    cpuCores: 2,
    memoryMb: 512,
    timeMs: 4000
  });
});
