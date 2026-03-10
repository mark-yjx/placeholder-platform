import { SubmissionResult } from '../api/PracticeApiClient';
import { createWebviewStyles, escapeHtml } from './WebviewTheme';

export type SubmissionDetailViewModel = {
  title: string;
  submissionId: string;
  submittedAt: string;
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

const UTC_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function parseSubmissionDate(value?: string): Date | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSubmissionDisplayId(value?: string): string | null {
  const parsed = parseSubmissionDate(value);
  if (!parsed) {
    return null;
  }

  return `Sub #${parsed.getUTCFullYear()}${padTwoDigits(parsed.getUTCMonth() + 1)}${padTwoDigits(parsed.getUTCDate())}-${padTwoDigits(parsed.getUTCHours())}${padTwoDigits(parsed.getUTCMinutes())}${padTwoDigits(parsed.getUTCSeconds())}`;
}

function formatSubmittedTimestamp(value?: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return 'Not available';
  }

  const parsed = parseSubmissionDate(trimmed);
  if (!parsed) {
    return trimmed;
  }

  return `${UTC_MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()} at ${padTwoDigits(parsed.getUTCHours())}:${padTwoDigits(parsed.getUTCMinutes())}:${padTwoDigits(parsed.getUTCSeconds())} UTC`;
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

function createSubmissionTone(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function createSubmissionDetailViewModel(input: {
  submissionId: string;
  status: string;
  submittedAt?: string;
  verdict?: SubmissionResult['verdict'];
  timeMs?: number;
  memoryKb?: number;
  failureInfo?: string;
  detail: string;
} | null): SubmissionDetailViewModel {
  if (!input) {
    return {
      title: 'Submission Detail',
      submissionId: 'Submission Detail',
      submittedAt: 'Not available',
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
  const submittedAt = formatSubmittedTimestamp(input.submittedAt);
  const publicFailure = parsePublicFailureDetail(`${input.detail} | ${input.failureInfo ?? ''}`);
  const hiddenFailureMessage =
    input.status === 'finished' && input.verdict === 'WA' && !publicFailure
      ? 'A hidden judge case failed. Private test details are intentionally not shown.'
      : null;

  return {
    title: formatSubmissionDisplayId(input.submittedAt) ?? 'Submission Result',
    submissionId: input.submissionId,
    submittedAt,
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
  const title = escapeHtml(input.title);
  const submissionId = escapeHtml(input.submissionId);
  const submittedAt = escapeHtml(input.submittedAt);
  const status = escapeHtml(input.status);
  const verdict = escapeHtml(input.verdict);
  const time = escapeHtml(input.time);
  const memory = escapeHtml(input.memory);
  const verdictTone = escapeHtml(createSubmissionTone(input.verdict));
  const failureInfo = input.failureInfo ? escapeHtml(input.failureInfo) : null;
  const detail = escapeHtml(input.detail);
  const emptyState = input.isEmpty
    ? '<p>Selecting a submission will load its status, verdict, timing, memory, and failure info here.</p>'
    : '';
  const submissionStyles = `
    body {
      padding: 16px;
    }

    .submission-detail-shell {
      max-width: 720px;
      gap: 16px;
    }

    .submission-detail-shell .hero-card h2 {
      font-size: 1.5rem;
    }

    .submission-detail-shell .hero-copy,
    .submission-detail-shell pre {
      font-size: 0.9rem;
    }

    .submission-detail-shell .submission-overview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }

    .submission-detail-shell .submission-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-muted);
      color: var(--text-secondary);
      font-size: 0.84rem;
    }

    .submission-detail-shell .submission-pill-hero {
      font-weight: 700;
      color: var(--text-primary);
    }

    .submission-detail-shell .submission-pill-ac {
      background: color-mix(in srgb, var(--vscode-testing-iconPassed) 18%, var(--surface));
    }

    .submission-detail-shell .submission-pill-wa,
    .submission-detail-shell .submission-pill-re,
    .submission-detail-shell .submission-pill-ce,
    .submission-detail-shell .submission-pill-tle,
    .submission-detail-shell .submission-pill-failed {
      background: color-mix(in srgb, var(--vscode-testing-iconFailed) 16%, var(--surface));
    }

    .submission-detail-shell .submission-summary {
      display: grid;
      gap: 10px;
    }

    .submission-detail-shell .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
    }

    .submission-detail-shell .summary-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .submission-detail-shell .summary-row:first-child {
      padding-top: 0;
    }

    .submission-detail-shell .summary-label {
      color: var(--text-secondary);
      font-size: 0.84rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }

    .submission-detail-shell .summary-value {
      text-align: right;
      font-weight: 600;
      line-height: 1.45;
    }
  `;
  const failureInfoSection = failureInfo
    ? `
      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Failure</p>
          <h3>Failure details</h3>
        </div>
        <div class="alert-card"><p><strong>Failure Info:</strong> ${failureInfo}</p></div>
      </section>
    `
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
      ${submissionStyles}
    </style>
  </head>
  <body>
    <main class="webview-shell section-stack submission-detail-shell">
      <section class="hero-card">
        <p class="eyebrow">Submission Detail</p>
        <h2>${title}</h2>
        ${emptyState}
        <p class="hero-copy">Submitted ${submittedAt}. Review the verdict, runtime, memory, and any student-visible failure details here.</p>
        ${
          input.isEmpty
            ? ''
            : `
              <div class="submission-overview">
                <span class="submission-pill submission-pill-hero submission-pill-${verdictTone}">${verdict}</span>
                <span class="submission-pill">Status: ${status}</span>
                <span class="submission-pill">Time: ${time}</span>
                <span class="submission-pill">Memory: ${memory}</span>
              </div>
            `
        }
        ${
          input.isEmpty
            ? ''
            : `
              <div class="inline-meta">
                <p><strong>Submission ID:</strong> <code>${submissionId}</code></p>
              </div>
            `
        }
      </section>

      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Run Summary</p>
          <h3>Verdict and metrics</h3>
        </div>
        <div class="submission-summary">
          <div class="summary-row">
            <span class="summary-label">Submitted</span>
            <div class="summary-value">${submittedAt}</div>
          </div>
          <div class="summary-row">
            <span class="summary-label">Verdict</span>
            <div class="summary-value">${verdict}</div>
          </div>
          <div class="summary-row">
            <span class="summary-label">Status</span>
            <div class="summary-value">${status}</div>
          </div>
          <div class="summary-row">
            <span class="summary-label">Time</span>
            <div class="summary-value">${time}</div>
          </div>
          <div class="summary-row">
            <span class="summary-label">Memory</span>
            <div class="summary-value">${memory}</div>
          </div>
        </div>
      </section>

      ${failureInfoSection}
      ${publicFailureSection}
      ${hiddenFailureSection}

      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Judge Note</p>
          <h3>Execution summary</h3>
        </div>
        <pre>${detail}</pre>
      </section>
    </main>
  </body>
</html>`;
}
