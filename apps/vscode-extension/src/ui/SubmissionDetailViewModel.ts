import { SubmissionResult } from '../api/PracticeApiClient';

export type SubmissionDetailViewModel = {
  submissionId: string;
  status: string;
  verdict: string;
  time: string;
  memory: string;
  failureInfo: string;
  detail: string;
  isEmpty: boolean;
};

export function createSubmissionDetailViewModel(input: {
  submissionId: string;
  status: string;
  verdict?: SubmissionResult['verdict'];
  timeMs?: number;
  memoryKb?: number;
  failureInfo?: string;
  detail: string;
} | null): SubmissionDetailViewModel {
  if (!input) {
    return {
      submissionId: 'Submission Detail',
      status: 'No submission selected yet.',
      verdict: 'Not available',
      time: 'Not available',
      memory: 'Not available',
      failureInfo: 'Select a submission from the Submissions list to view details here.',
      detail: 'No submission details available yet.',
      isEmpty: true
    };
  }

  return {
    submissionId: input.submissionId,
    status: input.status,
    verdict: input.verdict ?? 'Not available',
    time: input.timeMs === undefined ? 'Not available' : `${input.timeMs}ms`,
    memory: input.memoryKb === undefined ? 'Not available' : `${input.memoryKb}KB`,
    failureInfo: input.failureInfo ?? 'None',
    detail: input.detail,
    isEmpty: false
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createSubmissionDetailHtml(input: SubmissionDetailViewModel): string {
  const submissionId = escapeHtml(input.submissionId);
  const status = escapeHtml(input.status);
  const verdict = escapeHtml(input.verdict);
  const time = escapeHtml(input.time);
  const memory = escapeHtml(input.memory);
  const failureInfo = escapeHtml(input.failureInfo);
  const detail = escapeHtml(input.detail);
  const emptyState = input.isEmpty
    ? '<p>Selecting a submission will load its status, verdict, timing, memory, and failure info here.</p>'
    : '';

  return `<!doctype html>
<html lang="en">
  <body>
    <h2>${submissionId}</h2>
    ${emptyState}
    <p><strong>Status:</strong> ${status}</p>
    <p><strong>Verdict:</strong> ${verdict}</p>
    <p><strong>Time:</strong> ${time}</p>
    <p><strong>Memory:</strong> ${memory}</p>
    <p><strong>Failure Info:</strong> ${failureInfo}</p>
    <hr />
    <pre style="white-space: pre-wrap;">${detail}</pre>
  </body>
</html>`;
}
