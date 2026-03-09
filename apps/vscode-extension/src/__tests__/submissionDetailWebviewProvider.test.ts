import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionDetailHtml, createSubmissionDetailViewModel } from '../ui/SubmissionDetailViewModel';

test('submission detail renders expected fields for finished judged result', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048,
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    })
  );

  assert.match(html, /<h2>submission-1<\/h2>/);
  assert.match(html, /<strong>Status:<\/strong> finished/);
  assert.match(html, /<strong>Verdict:<\/strong> AC/);
  assert.match(html, /<strong>Time:<\/strong> 120ms/);
  assert.match(html, /<strong>Memory:<\/strong> 2048KB/);
  assert.match(html, /Raw result summary/);
  assert.doesNotMatch(html, /<strong>Failure Info:<\/strong>/);
});

test('submission detail renders neutral memory placeholder when memory is zero', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-zero-memory-1',
      status: 'finished',
      verdict: 'WA',
      timeMs: 120,
      memoryKb: 0,
      detail: 'verdict=WA, time=120ms, memory=N/A'
    })
  );

  assert.match(html, /<strong>Memory:<\/strong> N\/A/);
  assert.doesNotMatch(html, /0KB/);
});

test('submission detail renders neutral memory placeholder when memory is missing', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-missing-memory-1',
      status: 'finished',
      verdict: 'CE',
      timeMs: 11,
      detail: 'verdict=CE, time=11ms, memory=N/A'
    })
  );

  assert.match(html, /<strong>Memory:<\/strong> N\/A/);
  assert.doesNotMatch(html, /0KB/);
});

test('submission detail empty state shows friendly placeholder instead of blank panel', () => {
  const html = createSubmissionDetailHtml(createSubmissionDetailViewModel(null));

  assert.match(html, /<h2>Submission Detail<\/h2>/);
  assert.match(html, /No submission selected yet\./);
  assert.match(html, /Selecting a submission will load its status, verdict, timing, memory, and failure info here\./);
  assert.doesNotMatch(html, /<strong>Failure Info:<\/strong>/);
});

test('submission detail renders running state without a blank detail body', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-running-1',
      status: 'running',
      detail: ''
    })
  );

  assert.match(html, /<h2>submission-running-1<\/h2>/);
  assert.match(html, /<strong>Status:<\/strong> running/);
  assert.match(html, /Status: running/);
});

test('submission detail renders failed state with failure info fallback', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-failed-1',
      status: 'failed',
      failureInfo: 'compile step crashed',
      detail: ''
    })
  );

  assert.match(html, /<h2>submission-failed-1<\/h2>/);
  assert.match(html, /<strong>Status:<\/strong> failed/);
  assert.match(html, /<strong>Failure Info:<\/strong> compile step crashed/);
  assert.match(html, /Failed: compile step crashed/);
});

test('submission detail hides failure info for finished non-AC verdicts without failure text', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-ce-1',
      status: 'finished',
      verdict: 'CE',
      timeMs: 11,
      memoryKb: 22,
      detail: ''
    })
  );

  assert.match(html, /<strong>Status:<\/strong> finished/);
  assert.match(html, /<strong>Verdict:<\/strong> CE/);
  assert.match(html, /<strong>Time:<\/strong> 11ms/);
  assert.match(html, /<strong>Memory:<\/strong> 22KB/);
  assert.doesNotMatch(html, /<strong>Failure Info:<\/strong>/);
  assert.match(html, /verdict=CE, time=11ms, memory=22KB/);
});

test('submission detail keeps hidden wrong-answer feedback generic when no public case detail is available', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-hidden-wa-1',
      status: 'finished',
      verdict: 'WA',
      timeMs: 17,
      memoryKb: 88,
      detail: 'verdict=WA, time=17ms, memory=88KB'
    })
  );

  assert.match(html, /Hidden judge result/);
  assert.match(html, /Private test details are intentionally not shown\./);
});

test('submission detail renders structured public failure details when present', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-public-wa-1',
      status: 'finished',
      verdict: 'WA',
      timeMs: 9,
      memoryKb: 64,
      detail: 'Case 1 failed | input=[1,2] | expected=[3] | actual=[4] | diff=-3 +4'
    })
  );

  assert.match(html, /Public case details/);
  assert.match(html, /Expected Output/);
  assert.match(html, /Actual Output/);
  assert.match(html, /-3 \+4/);
});
