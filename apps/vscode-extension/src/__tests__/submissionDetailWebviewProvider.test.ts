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
      failureInfo: 'None',
      detail: 'Submission submission-1: verdict=AC, time=120ms, memory=2048KB'
    })
  );

  assert.match(html, /<h2>submission-1<\/h2>/);
  assert.match(html, /<strong>Status:<\/strong> finished/);
  assert.match(html, /<strong>Verdict:<\/strong> AC/);
  assert.match(html, /<strong>Time:<\/strong> 120ms/);
  assert.match(html, /<strong>Memory:<\/strong> 2048KB/);
  assert.match(html, /<strong>Failure Info:<\/strong> None/);
});

test('submission detail empty state shows friendly placeholder instead of blank panel', () => {
  const html = createSubmissionDetailHtml(createSubmissionDetailViewModel(null));

  assert.match(html, /<h2>Submission Detail<\/h2>/);
  assert.match(html, /No submission selected yet\./);
  assert.match(html, /Select a submission from the Submissions list to view details here\./);
  assert.match(html, /Selecting a submission will load its status, verdict, timing, memory, and failure info here\./);
});
