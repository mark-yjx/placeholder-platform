import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStarterFileProblemId } from '../ui/StarterFileCodeLensProvider';

test('starter file code lens provider resolves problem ids from coding file paths', () => {
  assert.equal(resolveStarterFileProblemId('/workspace/.oj/problems/collapse.py'), 'collapse');
  assert.equal(resolveStarterFileProblemId('C:\\workspace\\.oj\\problems\\two_sum.py'), 'two_sum');
  assert.equal(resolveStarterFileProblemId('/workspace/src/solution.py'), null);
  assert.equal(resolveStarterFileProblemId(undefined), null);
});
