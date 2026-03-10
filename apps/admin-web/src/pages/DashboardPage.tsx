import { useEffect, useMemo, useState } from 'react';
import { fetchAdminAnalyticsOverview, type AdminAnalyticsOverview } from '../api/analytics';
import { fetchAdminProblems, type AdminProblemListItem } from '../api/problems';
import { fetchAdminSubmissions, type AdminSubmissionListItem } from '../api/submissions';
import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../auth/AuthContext';
import { readStoredAdminToken } from '../auth/storage';
import './DashboardPage.css';

type LoadState = 'loading' | 'ready' | 'error';

type ProblemSolveStat = {
  problemId: string;
  title: string;
  solves: number;
};

type ChartPoint = {
  label: string;
  value: number;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value);
}

function formatDayLabel(value: Date): string {
  return value.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function toDayKey(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDailySubmissionSeries(
  submissions: readonly AdminSubmissionListItem[],
  dayCount: number
): readonly ChartPoint[] {
  const counts = new Map<string, number>();
  for (const submission of submissions) {
    const dayKey = toDayKey(submission.submittedAt);
    if (!dayKey) {
      continue;
    }
    counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
  }

  const now = new Date();
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (dayCount - index - 1));
    const dayKey = date.toISOString().slice(0, 10);
    return {
      label: formatDayLabel(date),
      value: counts.get(dayKey) ?? 0
    };
  });
}

function buildDailyActiveUserSeries(
  submissions: readonly AdminSubmissionListItem[],
  dayCount: number
): readonly ChartPoint[] {
  const counts = new Map<string, Set<string>>();
  for (const submission of submissions) {
    const dayKey = toDayKey(submission.submittedAt);
    if (!dayKey) {
      continue;
    }
    const users = counts.get(dayKey) ?? new Set<string>();
    users.add(submission.ownerUserId);
    counts.set(dayKey, users);
  }

  const now = new Date();
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (dayCount - index - 1));
    const dayKey = date.toISOString().slice(0, 10);
    return {
      label: formatDayLabel(date),
      value: counts.get(dayKey)?.size ?? 0
    };
  });
}

function buildProblemSolveStats(
  problems: readonly AdminProblemListItem[],
  submissions: readonly AdminSubmissionListItem[]
): { mostSolved: readonly ProblemSolveStat[]; leastSolved: readonly ProblemSolveStat[] } {
  const solveCounts = new Map<string, number>();
  for (const problem of problems) {
    solveCounts.set(problem.problemId, 0);
  }

  for (const submission of submissions) {
    if (submission.verdict !== 'AC') {
      continue;
    }
    solveCounts.set(submission.problemId, (solveCounts.get(submission.problemId) ?? 0) + 1);
  }

  const stats = problems.map((problem) => ({
    problemId: problem.problemId,
    title: problem.title,
    solves: solveCounts.get(problem.problemId) ?? 0
  }));

  return {
    mostSolved: [...stats]
      .sort((left, right) => right.solves - left.solves || left.title.localeCompare(right.title))
      .slice(0, 5),
    leastSolved: [...stats]
      .sort((left, right) => left.solves - right.solves || left.title.localeCompare(right.title))
      .slice(0, 5)
  };
}

function MetricCard(props: { label: string; value: string; copy: string }) {
  return (
    <article className="analytics-card">
      <p className="eyebrow">{props.label}</p>
      <h2>{props.value}</h2>
      <p className="hint">{props.copy}</p>
    </article>
  );
}

function MiniBarChart(props: {
  title: string;
  copy: string;
  points: readonly ChartPoint[];
  emptyMessage: string;
}) {
  const maxValue = Math.max(...props.points.map((point) => point.value), 1);

  return (
    <section className="analytics-chart-card">
      <div className="analytics-section-header">
        <p className="eyebrow">{props.title}</p>
        <p className="hint">{props.copy}</p>
      </div>
      {props.points.length === 0 ? (
        <p className="hint">{props.emptyMessage}</p>
      ) : (
        <div className="mini-chart" role="img" aria-label={props.title}>
          {props.points.map((point) => (
            <div className="mini-chart-column" key={point.label}>
              <div className="mini-chart-value">{point.value}</div>
              <div className="mini-chart-bar">
                <div
                  className="mini-chart-fill"
                  style={{ height: `${Math.max(8, Math.round((point.value / maxValue) * 100))}%` }}
                />
              </div>
              <div className="mini-chart-label">{point.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HorizontalChart(props: {
  title: string;
  copy: string;
  points: readonly ChartPoint[];
  emptyMessage: string;
}) {
  const maxValue = Math.max(...props.points.map((point) => point.value), 1);

  return (
    <section className="analytics-chart-card">
      <div className="analytics-section-header">
        <p className="eyebrow">{props.title}</p>
        <p className="hint">{props.copy}</p>
      </div>
      {props.points.length === 0 ? (
        <p className="hint">{props.emptyMessage}</p>
      ) : (
        <div className="horizontal-chart">
          {props.points.map((point) => (
            <div className="horizontal-chart-row" key={point.label}>
              <div className="horizontal-chart-copy">
                <span>{point.label}</span>
                <strong>{formatNumber(point.value)}</strong>
              </div>
              <div className="horizontal-chart-track">
                <div
                  className="horizontal-chart-fill"
                  style={{ width: `${Math.max(10, Math.round((point.value / maxValue) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProblemRankList(props: {
  title: string;
  items: readonly ProblemSolveStat[];
  emptyMessage: string;
}) {
  return (
    <section className="analytics-list-card">
      <div className="analytics-section-header">
        <p className="eyebrow">{props.title}</p>
      </div>
      {props.items.length === 0 ? (
        <p className="hint">{props.emptyMessage}</p>
      ) : (
        <div className="analytics-list">
          {props.items.map((item, index) => (
            <div className="analytics-list-row" key={item.problemId}>
              <span className="analytics-list-rank">#{index + 1}</span>
              <div className="analytics-list-copy">
                <strong>{item.title}</strong>
                <span>{item.problemId}</span>
              </div>
              <span>{formatNumber(item.solves)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionListItem[]>([]);
  const [problems, setProblems] = useState<AdminProblemListItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    const token = readStoredAdminToken();
    if (!token) {
      setOverview(null);
      setSubmissions([]);
      setProblems([]);
      setState('error');
      setError('Admin session is missing.');
      return;
    }

    setError(null);
    setState('loading');

    try {
      const [nextOverview, nextSubmissions, nextProblems] = await Promise.all([
        fetchAdminAnalyticsOverview(token),
        fetchAdminSubmissions(token),
        fetchAdminProblems(token)
      ]);
      setOverview(nextOverview);
      setSubmissions(nextSubmissions);
      setProblems(nextProblems);
      setState('ready');
    } catch (loadError) {
      setOverview(null);
      setSubmissions([]);
      setProblems([]);
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin analytics.');
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const problemStats = useMemo(() => buildProblemSolveStats(problems, submissions), [problems, submissions]);
  const submissionSeries = useMemo(() => buildDailySubmissionSeries(submissions, 14), [submissions]);
  const activeUserSeries = useMemo(() => buildDailyActiveUserSeries(submissions, 14), [submissions]);
  const languageSeries = useMemo<readonly ChartPoint[]>(
    () => [{ label: 'Python', value: overview?.totalSubmissions ?? 0 }],
    [overview]
  );
  const difficultySeries = useMemo<readonly ChartPoint[]>(
    () => [
      { label: 'Easy', value: 0 },
      { label: 'Medium', value: 0 },
      { label: 'Hard', value: 0 }
    ],
    []
  );

  return (
    <AdminLayout
      actions={
        <button className="secondary-button" onClick={() => void loadOverview()} type="button">
          Refresh
        </button>
      }
      description="A minimal platform pulse with problem, usage, and activity signals."
      meta={`Signed in as ${user?.email ?? 'admin'}.`}
      title="Analytics Overview"
    >
      <section className="card content-card analytics-shell">
        {state === 'loading' ? <p className="hint">Loading platform analytics...</p> : null}
        {state === 'error' && error ? <p className="error-message">{error}</p> : null}

        {state === 'ready' && overview ? (
          <>
            <div className="analytics-grid">
              <MetricCard
                label="Users"
                value={formatNumber(overview.totalUsers)}
                copy="Total accounts currently tracked on the platform."
              />
              <MetricCard
                label="Submissions"
                value={formatNumber(overview.totalSubmissions)}
                copy="All submission attempts recorded so far."
              />
              <MetricCard
                label="Accepted"
                value={formatNumber(overview.totalAcceptedSubmissions)}
                copy="Accepted submissions across all student-visible work."
              />
              <MetricCard
                label="Active users"
                value={formatNumber(overview.activeUsers)}
                copy={`Students active in the last ${overview.activeWindowDays} days.`}
              />
              <MetricCard
                label="Unique solves"
                value={formatNumber(overview.uniqueProblemSolves)}
                copy="Unique user/problem solves derived from accepted submissions."
              />
            </div>

            <div className="analytics-problem-grid">
              <ProblemRankList
                title="Most solved problems"
                items={problemStats.mostSolved}
                emptyMessage="Problem solve data will appear once students submit accepted work."
              />
              <ProblemRankList
                title="Least solved problems"
                items={problemStats.leastSolved}
                emptyMessage="Problem solve data will appear once students submit accepted work."
              />
            </div>

            <div className="analytics-chart-grid">
              <MiniBarChart
                title="Submission volume"
                copy="Daily submission counts over the last 14 days."
                points={submissionSeries}
                emptyMessage="Submission volume will appear once the platform records submissions."
              />
              <MiniBarChart
                title="Active users"
                copy="Unique students submitting work over the last 14 days."
                points={activeUserSeries}
                emptyMessage="Active user history will appear once the platform records submissions."
              />
              <HorizontalChart
                title="Language usage"
                copy="Current student runtime usage based on supported platform languages."
                points={languageSeries}
                emptyMessage="Language usage will appear once submissions exist."
              />
            </div>

            <HorizontalChart
              title="Difficulty completion"
              copy="Difficulty bars are reserved for future admin metadata once problem difficulty is exposed in admin APIs."
              points={difficultySeries}
              emptyMessage="Difficulty completion will appear when problem metadata becomes available."
            />
          </>
        ) : null}
      </section>
    </AdminLayout>
  );
}
