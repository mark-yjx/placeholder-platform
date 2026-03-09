import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminProblems, type AdminProblemListItem } from '../api/problems';
import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../auth/AuthContext';
import { readStoredAdminToken } from '../auth/storage';

type LoadState = 'loading' | 'ready' | 'error';

function formatVisibilityLabel(value: string): string {
  if (value === 'public') {
    return 'published';
  }

  if (value === 'private') {
    return 'archived';
  }

  return value;
}

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

export function ProblemsListPage() {
  const { user } = useAuth();
  const [problems, setProblems] = useState<AdminProblemListItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadProblems() {
    const token = readStoredAdminToken();
    if (!token) {
      setProblems([]);
      setState('error');
      setError('Admin session is missing.');
      return;
    }

    setError(null);
    setState((currentState) => (currentState === 'ready' ? currentState : 'loading'));
    setIsRefreshing(true);

    try {
      const items = await fetchAdminProblems(token);
      setProblems(items);
      setState('ready');
    } catch (loadError) {
      setProblems([]);
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load problems.');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadProblems();
  }, []);

  return (
    <AdminLayout
      actions={
        <>
          <Link className="primary-button link-button" to="/admin/problems/create">
            Create Problem
          </Link>
          <button className="secondary-button" onClick={() => void loadProblems()} type="button">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </>
      }
      description="Manage draft and published problems from a cleaner editing workspace."
      meta={`Signed in as ${user?.email ?? 'admin'}.`}
      title="Problems"
    >
      <section className="card content-card table-card">
        {state === 'loading' ? <p className="hint">Loading problems...</p> : null}

        {state === 'error' && error ? <p className="error-message">{error}</p> : null}

        {state === 'ready' && problems.length === 0 ? (
          <p className="hint">No problems are available yet.</p>
        ) : null}

        {state === 'ready' && problems.length > 0 ? (
          <div className="table-wrap">
            <table className="problems-table">
              <thead>
                <tr>
                  <th>Problem ID</th>
                  <th>Title</th>
                  <th>Visibility</th>
                  <th>Updated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => {
                  const visibilityLabel = formatVisibilityLabel(problem.visibility);

                  return (
                    <tr key={problem.problemId}>
                      <td>
                        <Link className="problem-link" to={`/admin/problems/${problem.problemId}`}>
                          {problem.problemId}
                        </Link>
                      </td>
                      <td>
                        <Link className="problem-link" to={`/admin/problems/${problem.problemId}`}>
                          {problem.title}
                        </Link>
                      </td>
                      <td>
                        <span className={`status-pill ${visibilityLabel}`}>{visibilityLabel}</span>
                      </td>
                      <td>{formatTimestamp(problem.updatedAt)}</td>
                      <td>
                        <Link className="problem-link" to={`/admin/problems/${problem.problemId}`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AdminLayout>
  );
}
