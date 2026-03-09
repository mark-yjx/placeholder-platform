import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAdminSubmission, type AdminSubmissionDetail } from '../api/submissions';
import { readStoredAdminToken } from '../auth/storage';

type LoadState = 'loading' | 'ready' | 'error';

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatMetric(value: number | null, unit: string): string {
  return value === null ? 'N/A' : `${value} ${unit}`;
}

export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [submission, setSubmission] = useState<AdminSubmissionDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubmission() {
      if (!submissionId) {
        setLoadState('error');
        setError('Submission ID is missing.');
        return;
      }

      const token = readStoredAdminToken();
      if (!token) {
        setLoadState('error');
        setError('Admin session is missing.');
        return;
      }

      setLoadState('loading');
      setError(null);

      try {
        const detail = await fetchAdminSubmission(token, submissionId);
        setSubmission(detail);
        setLoadState('ready');
      } catch (loadError) {
        setSubmission(null);
        setLoadState('error');
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load the selected submission.'
        );
      }
    }

    void loadSubmission();
  }, [submissionId]);

  return (
    <main className="shell">
      <section className="card problems-card">
        <div className="page-header">
          <div>
            <p className="eyebrow">OJ Admin Web</p>
            <h1>Submission Detail</h1>
            <p className="message">Inspect admin-visible submission metadata and result state.</p>
          </div>

          <div className="header-actions">
            <Link className="secondary-button link-button" to="/submissions">
              Back to Submissions
            </Link>
            <Link className="secondary-button link-button" to="/">
              Problems
            </Link>
          </div>
        </div>

        {loadState === 'loading' ? <p className="hint">Loading submission details...</p> : null}
        {loadState === 'error' && error ? <p className="error-message">{error}</p> : null}

        {loadState === 'ready' && submission ? (
          <div className="problem-form">
            <section className="form-section">
              <h2>Basic Metadata</h2>
              <div className="detail-grid">
                <div>
                  <p className="detail-label">Submission ID</p>
                  <p className="detail-value">{submission.submissionId}</p>
                </div>
                <div>
                  <p className="detail-label">User</p>
                  <p className="detail-value">{submission.ownerUserId}</p>
                </div>
                <div>
                  <p className="detail-label">Problem</p>
                  <p className="detail-value">{submission.problemId}</p>
                </div>
                <div>
                  <p className="detail-label">Status</p>
                  <p className="detail-value">{submission.status}</p>
                </div>
                <div>
                  <p className="detail-label">Verdict</p>
                  <p className="detail-value">{submission.verdict ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="detail-label">Submitted At</p>
                  <p className="detail-value">{formatTimestamp(submission.submittedAt)}</p>
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Runtime Metrics</h2>
              <div className="detail-grid">
                <div>
                  <p className="detail-label">Time</p>
                  <p className="detail-value">{formatMetric(submission.timeMs, 'ms')}</p>
                </div>
                <div>
                  <p className="detail-label">Memory</p>
                  <p className="detail-value">{formatMetric(submission.memoryKb, 'KB')}</p>
                </div>
              </div>
            </section>

            {submission.failureReason || submission.errorDetail ? (
              <section className="form-section">
                <h2>Failure / Error</h2>
                {submission.failureReason ? (
                  <div>
                    <p className="detail-label">Failure Reason</p>
                    <p className="detail-value">{submission.failureReason}</p>
                  </div>
                ) : null}
                {submission.errorDetail ? (
                  <div>
                    <p className="detail-label">Error Detail</p>
                    <p className="detail-value">{submission.errorDetail}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {submission.sourceSnapshot ? (
              <section className="form-section">
                <h2>Source Snapshot</h2>
                <pre className="code-block">{submission.sourceSnapshot}</pre>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
