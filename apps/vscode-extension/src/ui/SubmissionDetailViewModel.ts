import { SubmissionResult } from '../api/PracticeApiClient';
import { createWebviewStyles, escapeHtml } from './WebviewTheme';

export type SubmissionDetailViewModel = {
  submissionId: string;
  status: string;
  verdict: string;
  time: string;
  memory: string;
  failureInfo: string | null;
  detail: string;
  publicFailure: {
    input?: string;
    expected?: string;
    actual?: string;
    diff?: string;
  } | null;
  hiddenFailureMessage: string | null;
  isEmpty: boolean;
};

function normalizeSubmissionText(value?: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function formatMemoryMetric(memoryKb?: number): string {
  return memoryKb !== undefined && memoryKb > 0 ? `${memoryKb}KB` : 'N/A';
}

function extractPipeValue(source: string, key: string): string | null {
  const match = source.match(new RegExp(`(?:^|\\|)\\s*${key}=([^|]+)`));
  const value = match?.[1]?.trim() ?? '';
  return value ? value : null;
}

function parsePublicFailureDetail(detail: string): {
  input?: string;
  expected?: string;
  actual?: string;
  diff?: string;
} | null {
  const input = extractPipeValue(detail, 'input');
  const expected = extractPipeValue(detail, 'expected');
  const actual = extractPipeValue(detail, 'actual');
  const diff = extractPipeValue(detail, 'diff');

  if (!input && !expected && !actual && !diff) {
    return null;
  }

  return {
    input: input ?? undefined,
    expected: expected ?? undefined,
    actual: actual ?? undefined,
    diff: diff ?? undefined
  };
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
      publicFailure: null,
      hiddenFailureMessage: null,
      isEmpty: true
    };
  }

  const failureInfo = normalizeSubmissionText(input.failureInfo);
  const detail = buildSubmissionDetailText(input);
  const publicFailure = parsePublicFailureDetail(`${input.detail} | ${input.failureInfo ?? ''}`);
  const hiddenFailureMessage =
    input.status === 'finished' && input.verdict === 'WA' && !publicFailure
      ? 'A hidden judge case failed. Private test details are intentionally not shown.'
      : null;

  return {
    submissionId: input.submissionId,
    status: input.status,
    verdict: input.verdict ?? 'Not available',
    time: input.timeMs === undefined ? 'Not available' : `${input.timeMs}ms`,
    memory: formatMemoryMetric(input.memoryKb),
    failureInfo,
    detail,
    publicFailure,
    hiddenFailureMessage,
    isEmpty: false
  };
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
    ? `<div class="alert-card"><p><strong>Failure Info:</strong> ${failureInfo}</p></div>`
    : '';
  const publicFailureSection = input.publicFailure
    ? `
      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Failure</p>
          <h3>Public case details</h3>
          <p class="section-copy">This failing case is safe to show because it comes from a public test.</p>
        </div>
        <div class="case-grid">
          ${
            input.publicFailure.input
              ? `<article class="case-card"><p class="field-label">Input</p><pre class="case-value">${escapeHtml(input.publicFailure.input)}</pre></article>`
              : ''
          }
          ${
            input.publicFailure.expected
              ? `<article class="case-card"><p class="field-label">Expected Output</p><pre class="case-value">${escapeHtml(input.publicFailure.expected)}</pre></article>`
              : ''
          }
          ${
            input.publicFailure.actual
              ? `<article class="case-card"><p class="field-label">Actual Output</p><pre class="case-value">${escapeHtml(input.publicFailure.actual)}</pre></article>`
              : ''
          }
          ${
            input.publicFailure.diff
              ? `<article class="case-card"><p class="field-label">Diff</p><pre class="case-value">${escapeHtml(input.publicFailure.diff)}</pre></article>`
              : ''
          }
        </div>
      </section>
    `
    : '';
  const hiddenFailureSection = input.hiddenFailureMessage
    ? `
      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Failure</p>
          <h3>Hidden judge result</h3>
        </div>
        <div class="alert-card">
          <p>${escapeHtml(input.hiddenFailureMessage)}</p>
        </div>
      </section>
    `
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      ${createWebviewStyles()}
    </style>
  </head>
  <body>
    <main class="webview-shell section-stack">
      <section class="hero-card">
        <p class="eyebrow">Submission Detail</p>
        <h2>${submissionId}</h2>
        ${emptyState}
        <p class="hero-copy">Review verdict, timing, memory, and any student-visible failure details in one place.</p>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <p class="field-label">Status</p>
          <p class="metric-value"><strong>Status:</strong> ${status}</p>
        </article>
        <article class="metric-card">
          <p class="field-label">Verdict</p>
          <p class="metric-value"><strong>Verdict:</strong> ${verdict}</p>
        </article>
        <article class="metric-card">
          <p class="field-label">Time</p>
          <p class="metric-value"><strong>Time:</strong> ${time}</p>
        </article>
        <article class="metric-card">
          <p class="field-label">Memory</p>
          <p class="metric-value"><strong>Memory:</strong> ${memory}</p>
        </article>
      </section>

      ${failureInfoSection}
      ${publicFailureSection}
      ${hiddenFailureSection}

      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Judge Detail</p>
          <h3>Raw result summary</h3>
        </div>
        <pre>${detail}</pre>
      </section>
    </main>
  </body>
</html>`;
}
