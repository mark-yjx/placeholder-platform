import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PracticeViewState,
  formatSubmissionDetail,
  formatPendingSubmissionDetail,
  formatPendingSubmissionSummary,
  formatSubmissionSummary
} from '../ui/PracticeViewState';

test('problem tree nodes mirror loaded problem data', () => {
  const state = new PracticeViewState();

  state.setProblems([
    { problemId: 'problem-1', title: 'Two Sum' },
    { problemId: 'problem-2', title: 'FizzBuzz' }
  ]);

  assert.deepEqual(state.getProblemNodes(), [
    { id: 'problem-1', label: 'Two Sum', description: 'problem-1' },
    { id: 'problem-2', label: 'FizzBuzz', description: 'problem-2' }
  ]);
});

test('submission tree nodes expose verdict, time, memory, and detail text', () => {
  const state = new PracticeViewState();

  state.recordSubmissionResult({
    submissionId: 'submission-1',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-1',
      label: 'submission-1',
      description: 'AC | 120ms | 2048KB',
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    }
  ]);
  assert.equal(state.getSubmissionDetail('submission-1'), 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB');
});

test('submission tree nodes include newly created submissions before results arrive', () => {
  const state = new PracticeViewState();

  state.recordSubmissionCreated('submission-pending-1');

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-pending-1',
      label: 'submission-pending-1',
      description: 'Submitted',
      detail: 'Submission submission-pending-1: submitted to API'
    }
  ]);
  assert.equal(
    state.getSubmissionDetail('submission-pending-1'),
    'Submission submission-pending-1: submitted to API'
  );
});

test('submission result replaces the pending tree entry for the same submission id', () => {
  const state = new PracticeViewState();

  state.recordSubmissionCreated('submission-1');
  state.recordSubmissionResult({
    submissionId: 'submission-1',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-1',
      label: 'submission-1',
      description: 'AC | 120ms | 2048KB',
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    }
  ]);
});

test('submission result renderers stay stable', () => {
  const result = {
    submissionId: 'submission-2',
    verdict: 'WA' as const,
    timeMs: 222,
    memoryKb: 4096
  };

  assert.equal(formatSubmissionSummary(result), 'WA | 222ms | 4096KB');
  assert.equal(
    formatSubmissionDetail(result),
    'Submission submission-2: verdict=WA, time=222ms, memory=4096KB'
  );
  assert.equal(formatPendingSubmissionSummary(), 'Submitted');
  assert.equal(
    formatPendingSubmissionDetail('submission-pending-2'),
    'Submission submission-pending-2: submitted to API'
  );
});
