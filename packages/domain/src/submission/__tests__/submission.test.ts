import test from 'node:test';
import assert from 'node:assert/strict';

import { Submission, SubmissionStatus } from '../index';

test('accepts legal lifecycle transitions queued -> running -> finished', () => {
  const queued = Submission.createQueued('submission-1');
  const running = queued.startRunning();
  const finished = running.finish();

  assert.equal(queued.status, SubmissionStatus.QUEUED);
  assert.equal(running.status, SubmissionStatus.RUNNING);
  assert.equal(finished.status, SubmissionStatus.FINISHED);
});

test('accepts legal lifecycle transitions queued -> running -> failed', () => {
  const failed = Submission.createQueued('submission-2').startRunning().fail();
  assert.equal(failed.status, SubmissionStatus.FAILED);
});

test('rejects invalid lifecycle transitions', () => {
  const queued = Submission.createQueued('submission-3');
  const running = queued.startRunning();
  const finished = running.finish();

  assert.throws(() => queued.finish(), /Invalid transition: queued -> finished/);
  assert.throws(() => queued.fail(), /Invalid transition: queued -> failed/);
  assert.throws(() => running.startRunning(), /Invalid transition: running -> running/);
  assert.throws(() => finished.startRunning(), /Invalid transition: finished -> running/);
});

test('terminal states are immutable', () => {
  const finished = Submission.createQueued('submission-4').startRunning().finish();
  const failed = Submission.createQueued('submission-5').startRunning().fail();

  assert.throws(() => finished.finish(), /Invalid transition: finished -> finished/);
  assert.throws(() => finished.fail(), /Invalid transition: finished -> failed/);
  assert.throws(() => failed.finish(), /Invalid transition: failed -> finished/);
  assert.throws(() => failed.fail(), /Invalid transition: failed -> failed/);
});
