import { useEffect, useState } from 'react';
import { fetchAdminAnalyticsOverview, type AdminAnalyticsOverview } from '../api/analytics';
import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../auth/AuthContext';
import { readStoredAdminToken } from '../auth/storage';
import './DashboardPage.css';

type LoadState = 'loading' | 'ready' | 'error';

export function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    const token = readStoredAdminToken();
    if (!token) {
      setOverview(null);
      setState('error');
      setError('Admin session is missing.');
      return;
    }

    setError(null);
    setState('loading');

    try {
      setOverview(await fetchAdminAnalyticsOverview(token));
      setState('ready');
    } catch (loadError) {
      setOverview(null);
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin analytics.');
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <AdminLayout
      actions={
        <button className="secondary-button" onClick={() => void loadOverview()} type="button">
          Refresh
        </button>
      }
      description="Keep a lightweight pulse on platform activity without leaving the admin workspace."
      meta={`Signed in as ${user?.email ?? 'admin'}.`}
      title="Overview"
    >
      <section className="card content-card">
        {state === 'loading' ? <p className="hint">Loading platform analytics...</p> : null}
        {state === 'error' && error ? <p className="error-message">{error}</p> : null}

        {state === 'ready' && overview ? (
          <div className="analytics-grid">
            <article className="analytics-card">
              <p className="eyebrow">Users</p>
              <h2>{overview.totalUsers}</h2>
              <p className="hint">Total platform accounts.</p>
            </article>
            <article className="analytics-card">
              <p className="eyebrow">Active Users</p>
              <h2>{overview.activeUsers}</h2>
              <p className="hint">Students with a submission in the last {overview.activeWindowDays} days.</p>
            </article>
            <article className="analytics-card">
              <p className="eyebrow">Submissions</p>
              <h2>{overview.totalSubmissions}</h2>
              <p className="hint">All recorded submissions.</p>
            </article>
            <article className="analytics-card">
              <p className="eyebrow">Accepted</p>
              <h2>{overview.totalAcceptedSubmissions}</h2>
              <p className="hint">Accepted submissions across the platform.</p>
            </article>
            <article className="analytics-card analytics-card-wide">
              <p className="eyebrow">Unique Solves</p>
              <h2>{overview.uniqueProblemSolves}</h2>
              <p className="hint">Unique user/problem solves based on accepted submissions.</p>
            </article>
          </div>
        ) : null}
      </section>
    </AdminLayout>
  );
}
