import { SubmissionResult } from '../api/PracticeApiClient';

export type SubmissionDetailViewModel = {
  submissionId: string;
  status: string;
  verdict: string;
  time: string;
  memory: string;
  failureInfo: string | null;
  detail: string;
  isEmpty: boolean;
};

function normalizeSubmissionText(value?: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function buildSubmissionDetailText(input: {
  status: string;
  verdict?: SubmissionResult['verdict'];
  timeMs?: number;
  memoryKb?: number;
  failureInfo?: string;
  detail: string;
}): string {
  const detail = normalizeSubmissionText(input.detail);
  if (detail) {
    return detail;
  }

  if (input.status === 'queued' || input.status === 'running') {
    return `Status: ${input.status}`;
  }

  const failureInfo = normalizeSubmissionText(input.failureInfo);
  if (input.status === 'failed') {
    return failureInfo ? `Failed: ${failureInfo}` : 'Failed: no failure reason available';
  }

  if (input.verdict && input.timeMs !== undefined && input.memoryKb !== undefined) {
    return `verdict=${input.verdict}, time=${input.timeMs}ms, memory=${input.memoryKb}KB`;
  }

  if (input.verdict) {
    return `verdict=${input.verdict}`;
  }

  return `Status: ${input.status}`;
}

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
      failureInfo: null,
      detail: 'No submission details available yet.',
      isEmpty: true
    };
  }

  const failureInfo = normalizeSubmissionText(input.failureInfo);
  const detail = buildSubmissionDetailText(input);

  return {
    submissionId: input.submissionId,
    status: input.status,
    verdict: input.verdict ?? 'Not available',
    time: input.timeMs === undefined ? 'Not available' : `${input.timeMs}ms`,
    memory: input.memoryKb === undefined ? 'Not available' : `${input.memoryKb}KB`,
    failureInfo,
    detail,
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
  const failureInfo = input.failureInfo ? escapeHtml(input.failureInfo) : null;
  const detail = escapeHtml(input.detail);
  const emptyState = input.isEmpty
    ? '<p>Selecting a submission will load its status, verdict, timing, memory, and failure info here.</p>'
    : '';
  const failureInfoSection = failureInfo
    ? `<p><strong>Failure Info:</strong> ${failureInfo}</p>`
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
    ${failureInfoSection}
    <hr />
    <pre style="white-space: pre-wrap;">${detail}</pre>
  </body>
</html>`;
}
