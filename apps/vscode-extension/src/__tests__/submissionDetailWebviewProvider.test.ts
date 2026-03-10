import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionDetailHtml, createSubmissionDetailViewModel } from '../ui/SubmissionDetailViewModel';

test('submission detail renders expected fields for finished judged result', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-1',
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048,
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    })
  );

  assert.match(html, /<h2>Sub #20260310-153045<\/h2>/);
  assert.match(html, /Submitted Mar 10, 2026 at 15:30:45 UTC\./);
  assert.match(html, /<strong>Submission ID:<\/strong> <code>submission-1<\/code>/);
  assert.match(html, /class="submission-overview"/);
  assert.match(html, /class="submission-pill submission-pill-hero submission-pill-ac">AC<\/span>/);
  assert.match(html, /Status: finished/);
  assert.match(html, /Time: 120ms/);
  assert.match(html, /Memory: 2048KB/);
  assert.match(html, /Verdict and metrics/);
  assert.match(html, /Execution summary/);
  assert.doesNotMatch(html, /class="metric-grid"/);
  assert.doesNotMatch(html, /class="metric-card"/);
  assert.doesNotMatch(html, /<strong>Failure Info:<\/strong>/);
});

test('submission detail renders neutral memory placeholder when memory is zero', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-zero-memory-1',
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
      verdict: 'WA',
      timeMs: 120,
      memoryKb: 0,
      detail: 'verdict=WA, time=120ms, memory=N/A'
    })
  );

  assert.match(html, /Memory: N\/A/);
  assert.doesNotMatch(html, /0KB/);
});

test('submission detail renders neutral memory placeholder when memory is missing', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-missing-memory-1',
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
      verdict: 'CE',
      timeMs: 11,
      detail: 'verdict=CE, time=11ms, memory=N/A'
    })
  );

  assert.match(html, /Memory: N\/A/);
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
      submittedAt: '2026-03-10T15:30:45.000Z',
      detail: ''
    })
  );

  assert.match(html, /<h2>Sub #20260310-153045<\/h2>/);
  assert.match(html, /Status: running/);
  assert.match(html, /Status: running/);
});

test('submission detail renders failed state with failure info fallback', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-failed-1',
      status: 'failed',
      submittedAt: '2026-03-10T15:30:45.000Z',
      failureInfo: 'compile step crashed',
      detail: ''
    })
  );

  assert.match(html, /<h2>Sub #20260310-153045<\/h2>/);
  assert.match(html, /Status: failed/);
  assert.match(html, /<strong>Failure Info:<\/strong> compile step crashed/);
  assert.match(html, /Failed: compile step crashed/);
});

test('submission detail hides failure info for finished non-AC verdicts without failure text', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-ce-1',
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
      verdict: 'CE',
      timeMs: 11,
      memoryKb: 22,
      detail: ''
    })
  );

  assert.match(html, /Status: finished/);
  assert.match(html, /class="submission-pill submission-pill-hero submission-pill-ce">CE<\/span>/);
  assert.match(html, /Time: 11ms/);
  assert.match(html, /Memory: 22KB/);
  assert.doesNotMatch(html, /<strong>Failure Info:<\/strong>/);
  assert.match(html, /verdict=CE, time=11ms, memory=22KB/);
});

test('submission detail keeps hidden wrong-answer feedback generic when no public case detail is available', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-hidden-wa-1',
      status: 'finished',
      submittedAt: '2026-03-10T15:30:45.000Z',
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
      submittedAt: '2026-03-10T15:30:45.000Z',
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

test('submission detail falls back to a neutral title when submitted time is unavailable', () => {
  const html = createSubmissionDetailHtml(
    createSubmissionDetailViewModel({
      submissionId: 'submission-no-time-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 42,
      memoryKb: 256,
      detail: 'verdict=AC, time=42ms, memory=256KB'
    })
  );

  assert.match(html, /<h2>Submission Result<\/h2>/);
  assert.match(html, /Submitted Not available\./);
  assert.match(html, /<strong>Submission ID:<\/strong> <code>submission-no-time-1<\/code>/);
  assert.doesNotMatch(html, /<h2>submission-no-time-1<\/h2>/);
});
