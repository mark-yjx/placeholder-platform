import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminSubmissions, type AdminSubmissionListItem } from '../api/submissions';
import { useAuth } from '../auth/AuthContext';
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

export function SubmissionsListPage() {
  const { logout, user } = useAuth();
  const [submissions, setSubmissions] = useState<AdminSubmissionListItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadSubmissions() {
    const token = readStoredAdminToken();
    if (!token) {
      setSubmissions([]);
      setState('error');
      setError('Admin session is missing.');
      return;
    }

    setError(null);
    setState((currentState) => (currentState === 'ready' ? currentState : 'loading'));
    setIsRefreshing(true);

    try {
      const items = await fetchAdminSubmissions(token);
      setSubmissions(items);
      setState('ready');
    } catch (loadError) {
      setSubmissions([]);
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load submissions.');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  return (
    <main className="shell">
      <section className="card problems-card">
        <div className="page-header">
          <div>
            <p className="eyebrow">OJ Admin Web</p>
            <h1>Submissions</h1>
            <p className="message">Inspect submissions across admin-visible users.</p>
            <p className="hint">Signed in as {user?.email ?? 'admin'}.</p>
          </div>

          <div className="header-actions">
            <Link className="secondary-button link-button" to="/">
              Problems
            </Link>
            <button className="secondary-button" onClick={() => void loadSubmissions()} type="button">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="secondary-button" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </div>

        {state === 'loading' ? <p className="hint">Loading submissions...</p> : null}
        {state === 'error' && error ? <p className="error-message">{error}</p> : null}
        {state === 'ready' && submissions.length === 0 ? (
          <p className="hint">No submissions are available yet.</p>
        ) : null}

        {state === 'ready' && submissions.length > 0 ? (
          <div className="table-wrap">
            <table className="problems-table">
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>User</th>
                  <th>Problem</th>
                  <th>Status</th>
                  <th>Verdict</th>
                  <th>Time</th>
                  <th>Memory</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.submissionId}>
                    <td>
                      <Link className="problem-link" to={`/submissions/${submission.submissionId}`}>
                        {submission.submissionId}
                      </Link>
                    </td>
                    <td>{submission.ownerUserId}</td>
                    <td>{submission.problemId}</td>
                    <td>{submission.status}</td>
                    <td>{submission.verdict ?? 'N/A'}</td>
                    <td>{formatMetric(submission.timeMs, 'ms')}</td>
                    <td>{formatMetric(submission.memoryKb, 'KB')}</td>
                    <td>{formatTimestamp(submission.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
