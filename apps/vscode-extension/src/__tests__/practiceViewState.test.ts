import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PracticeViewState,
  formatProblemDetail,
  formatSubmissionLabel,
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
    {
      id: 'problem-1',
      label: 'Two Sum',
      description: 'problem-1',
      detail: '# Two Sum\n\n- Problem ID: problem-1\n\n## Statement\n\nNo statement available.\n'
    },
    {
      id: 'problem-2',
      label: 'FizzBuzz',
      description: 'problem-2',
      detail: '# FizzBuzz\n\n- Problem ID: problem-2\n\n## Statement\n\nNo statement available.\n'
    }
  ]);
});

test('problem details render as markdown content', () => {
  const state = new PracticeViewState();
  state.setProblems([
    { problemId: 'problem-1', title: 'Two Sum', statementMarkdown: 'Add two numbers.' }
  ]);

  assert.equal(
    state.getProblemDetail('problem-1'),
    '# Two Sum\n\n- Problem ID: problem-1\n\n## Statement\n\nAdd two numbers.\n'
  );
  assert.equal(
    formatProblemDetail({ problemId: 'problem-2', title: 'FizzBuzz', statementMarkdown: '' }),
    '# FizzBuzz\n\n- Problem ID: problem-2\n\n## Statement\n\nNo statement available.\n'
  );
});

test('problem detail fetch updates cached statement for later reveal', () => {
  const state = new PracticeViewState();
  state.setProblems([{ problemId: 'problem-1', title: 'Two Sum' }]);

  state.showProblemDetail({
    problemId: 'problem-1',
    versionId: 'problem-1-v1',
    title: 'Two Sum',
    statementMarkdown: 'Return the sum of two integers.',
    starterCode: 'def solve():\n    pass\n'
  });

  assert.equal(
    state.getProblemDetail('problem-1'),
    '# Two Sum\n\n- Problem ID: problem-1\n\n## Statement\n\nReturn the sum of two integers.\n'
  );
});

test('selected problem is tracked only for loaded problems', () => {
  const state = new PracticeViewState();
  state.setProblems([
    { problemId: 'problem-1', title: 'Two Sum' },
    { problemId: 'problem-2', title: 'FizzBuzz' }
  ]);

  state.setSelectedProblem('problem-2');
  assert.equal(state.getSelectedProblemId(), 'problem-2');

  state.setProblems([{ problemId: 'problem-1', title: 'Two Sum' }]);
  assert.equal(state.getSelectedProblemId(), null);
});

test('submission tree nodes expose verdict, time, memory, and detail text', () => {
  const state = new PracticeViewState();

  state.recordSubmissionResult({
    submissionId: 'submission-1',
    status: 'finished',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-1',
      label: 'submission-1 | AC | 120ms | 2048KB',
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
      label: 'submission-pending-1 | Submitted',
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
    status: 'finished',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-1',
      label: 'submission-1 | AC | 120ms | 2048KB',
      description: 'AC | 120ms | 2048KB',
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    }
  ]);
});

test('running submissions render status without verdict metrics', () => {
  const state = new PracticeViewState();

  state.recordSubmissionResult({
    submissionId: 'submission-running-1',
    status: 'running'
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-running-1',
      label: 'submission-running-1 | running',
      description: 'running',
      detail: 'Submission submission-running-1: status=running'
    }
  ]);
});

test('failed submissions render failure reasons clearly in submission detail', () => {
  const state = new PracticeViewState();

  state.recordSubmissionResult({
    submissionId: 'submission-failed-1',
    status: 'failed',
    failureReason: 'sandbox could not start'
  });

  assert.deepEqual(state.getSubmissionNodes(), [
    {
      id: 'submission-failed-1',
      label: 'submission-failed-1 | failed | sandbox could not start',
      description: 'failed | sandbox could not start',
      detail: 'Submission submission-failed-1: failed - sandbox could not start'
    }
  ]);
  assert.equal(
    state.getSubmissionDetail('submission-failed-1'),
    'Submission submission-failed-1: failed - sandbox could not start'
  );
});

test('compile and runtime verdicts render as judged outcomes instead of generic failures', () => {
  const compileError = {
    submissionId: 'submission-ce-1',
    status: 'finished' as const,
    verdict: 'CE' as const,
    timeMs: 10,
    memoryKb: 20
  };
  const runtimeError = {
    submissionId: 'submission-re-1',
    status: 'finished' as const,
    verdict: 'RE' as const,
    timeMs: 30,
    memoryKb: 40
  };

  assert.equal(formatSubmissionSummary(compileError), 'Compile Error (CE) | 10ms | 20KB');
  assert.equal(
    formatSubmissionDetail(compileError),
    'Submission submission-ce-1: finished with compile error (CE), time=10ms, memory=20KB'
  );
  assert.equal(formatSubmissionSummary(runtimeError), 'Runtime Error (RE) | 30ms | 40KB');
  assert.equal(
    formatSubmissionDetail(runtimeError),
    'Submission submission-re-1: finished with runtime error (RE), time=30ms, memory=40KB'
  );
});

test('compile, runtime, and timeout verdicts include best-effort failure snippets when available', () => {
  const compileError = {
    submissionId: 'submission-ce-snippet-1',
    status: 'finished' as const,
    verdict: 'CE' as const,
    timeMs: 10,
    memoryKb: 20,
    failureReason: 'SyntaxError: invalid syntax on line 3'
  };
  const runtimeError = {
    submissionId: 'submission-re-snippet-1',
    status: 'finished' as const,
    verdict: 'RE' as const,
    timeMs: 30,
    memoryKb: 40,
    failureReason: 'ZeroDivisionError: division by zero'
  };
  const timeoutError = {
    submissionId: 'submission-tle-snippet-1',
    status: 'finished' as const,
    verdict: 'TLE' as const,
    timeMs: 2000,
    memoryKb: 128,
    failureReason: 'Execution exceeded the 2s time limit'
  };

  assert.equal(
    formatSubmissionSummary(compileError),
    'Compile Error (CE) | 10ms | 20KB | SyntaxError: invalid syntax on line 3'
  );
  assert.equal(
    formatSubmissionDetail(compileError),
    'Submission submission-ce-snippet-1: finished with compile error (CE), time=10ms, memory=20KB | SyntaxError: invalid syntax on line 3'
  );
  assert.equal(
    formatSubmissionSummary(runtimeError),
    'Runtime Error (RE) | 30ms | 40KB | ZeroDivisionError: division by zero'
  );
  assert.equal(
    formatSubmissionDetail(runtimeError),
    'Submission submission-re-snippet-1: finished with runtime error (RE), time=30ms, memory=40KB | ZeroDivisionError: division by zero'
  );
  assert.equal(
    formatSubmissionSummary(timeoutError),
    'Time Limit Exceeded (TLE) | 2000ms | 128KB | Execution exceeded the 2s time limit'
  );
  assert.equal(
    formatSubmissionDetail(timeoutError),
    'Submission submission-tle-snippet-1: finished with time limit exceeded (TLE), time=2000ms, memory=128KB | Execution exceeded the 2s time limit'
  );
});

test('terminal submission results are not overwritten by later updates', () => {
  const state = new PracticeViewState();

  state.recordSubmissionResult({
    submissionId: 'submission-locked-1',
    status: 'finished',
    verdict: 'AC',
    timeMs: 120,
    memoryKb: 2048
  });
  state.recordSubmissionResult({
    submissionId: 'submission-locked-1',
    status: 'running'
  });

  assert.equal(
    state.getSubmissionDetail('submission-locked-1'),
    'Submission submission-locked-1: verdict=AC, time=120ms, memory=2048KB'
  );
});

test('submission result renderers stay stable', () => {
  const result = {
    submissionId: 'submission-2',
    status: 'finished' as const,
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
  assert.equal(formatSubmissionLabel('submission-2', 'WA | 222ms | 4096KB'), 'submission-2 | WA | 222ms | 4096KB');
  assert.equal(formatSubmissionSummary({ submissionId: 'submission-3', status: 'running' }), 'running');
  assert.equal(
    formatSubmissionDetail({ submissionId: 'submission-3', status: 'running' }),
    'Submission submission-3: status=running'
  );
  assert.equal(
    formatSubmissionDetail({
      submissionId: 'submission-4',
      status: 'failed',
      failureReason: 'sandbox could not start'
    }),
    'Submission submission-4: failed - sandbox could not start'
  );
});
