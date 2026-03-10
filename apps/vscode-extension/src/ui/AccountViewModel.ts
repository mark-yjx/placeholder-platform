import {
  LeaderboardScope,
  LeaderboardView,
  StatsBreakdownView,
  StudentStatsView
} from '../api/EngagementApiClient';
import { SubmissionResult } from '../api/PracticeApiClient';
import { createWebviewStyles, escapeHtml } from './WebviewTheme';

const LEADERBOARD_SCOPES: readonly LeaderboardScope[] = ['all-time', 'weekly', 'monthly', 'streak'];

export type AccountViewModel = {
  title: string;
  status: string;
  email: string;
  role: string;
  errorMessage: string;
  statsErrorMessage: string;
  isAuthenticated: boolean;
  isLoadingStats: boolean;
  stats: StudentStatsView | null;
  leaderboards: Partial<Record<LeaderboardScope, LeaderboardView>>;
  selectedLeaderboardScope: LeaderboardScope;
  recentSubmissions: readonly SubmissionResult[];
};

function normalizeIdentityField(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatScopeLabel(scope: LeaderboardScope): string {
  if (scope === 'all-time') {
    return 'All Time';
  }
  return formatLabel(scope);
}

function createInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email.trim();
  const parts = source.split(/[\s@._-]+/).filter((part) => part.length > 0);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return initials || 'PP';
}

function renderBarChart(
  entries: readonly StatsBreakdownView[],
  emptyMessage: string,
  unitLabel: string
): string {
  if (entries.length === 0) {
    return `<p class="section-copy">${escapeHtml(emptyMessage)}</p>`;
  }

  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  return `<div class="bar-chart">
    ${entries
      .map((entry) => {
        const width = Math.max(8, Math.round((entry.count / maxCount) * 100));
        return `<div class="bar-row">
          <div class="bar-row-copy">
            <span>${escapeHtml(formatLabel(entry.key))}</span>
            <strong>${entry.count} ${escapeHtml(unitLabel)}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
        </div>`;
      })
      .join('')}
  </div>`;
}

function renderBadges(stats: StudentStatsView | null): string {
  if (!stats) {
    return '<p class="section-copy">Sign in to unlock badges.</p>';
  }

  return `<div class="badge-grid">
    ${stats.badges
      .map((badge) => {
        const stateLabel = badge.earned ? 'Earned' : 'In progress';
        return `<article class="badge-chip ${badge.earned ? 'badge-earned' : 'badge-locked'}" title="${escapeHtml(
          badge.description
        )}">
          <div class="badge-header">
            <p class="badge-title">${escapeHtml(badge.title)}</p>
            <span class="badge-state">${stateLabel}</span>
          </div>
          <p class="badge-copy">${escapeHtml(badge.description)}</p>
        </article>`;
      })
      .join('')}
  </div>`;
}

function buildActivityCells(stats: StudentStatsView | null): readonly number[] {
  const totalCells = 140;
  if (!stats) {
    return Array.from({ length: totalCells }, () => 0);
  }

  const filledCells = Math.min(totalCells, Math.round((stats.activeDays / 365) * totalCells));
  const strongestCells = Math.min(filledCells, stats.currentStreak);
  const strongerCells = Math.min(Math.max(0, filledCells - strongestCells), stats.longestStreak);

  return Array.from({ length: totalCells }, (_, index) => {
    const positionFromEnd = totalCells - index;
    if (positionFromEnd <= strongestCells) {
      return 4;
    }
    if (positionFromEnd <= strongestCells + strongerCells) {
      return 3;
    }
    if (positionFromEnd <= filledCells) {
      return positionFromEnd % 3 === 0 ? 2 : 1;
    }
    return 0;
  });
}

function renderActivitySummary(stats: StudentStatsView | null): string {
  if (!stats) {
    return '<p class="section-copy">Activity history appears after your first submissions.</p>';
  }

  return `<div class="activity-card">
    <div class="activity-grid" aria-label="Activity summary">
      ${buildActivityCells(stats)
        .map((level) => `<span class="activity-cell activity-level-${level}"></span>`)
        .join('')}
    </div>
    <div class="activity-meta">
      <p><strong>${stats.activeDays}</strong> active days recorded</p>
      <p>Current streak: <strong>${stats.currentStreak} days</strong></p>
      <p>Longest streak: <strong>${stats.longestStreak} days</strong></p>
    </div>
  </div>`;
}

function renderRecentActivity(submissions: readonly SubmissionResult[]): string {
  if (submissions.length === 0) {
    return '<p class="section-copy">Your latest judged results will appear here.</p>';
  }

  return `<div class="recent-results-table">
    <div class="recent-results-head">
      <span>Submission</span>
      <span>Verdict</span>
      <span>Runtime</span>
      <span>Language</span>
    </div>
    ${submissions
      .slice(0, 6)
      .map((submission) => {
        const verdict = submission.verdict ?? submission.status.toUpperCase();
        const runtime =
          submission.timeMs !== undefined ? `${submission.timeMs} ms` : submission.status === 'finished' ? 'N/A' : 'Pending';
        return `<div class="recent-results-row">
          <span class="recent-results-id">${escapeHtml(submission.submissionId)}</span>
          <span class="status-pill status-${escapeHtml(verdict.toLowerCase())}">${escapeHtml(verdict)}</span>
          <span>${escapeHtml(runtime)}</span>
          <span>Python</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

function renderLeaderboardTabs(
  leaderboards: Partial<Record<LeaderboardScope, LeaderboardView>>,
  selectedScope: LeaderboardScope
): string {
  return `<div class="leaderboard-tabs" role="tablist" aria-label="Leaderboard scopes">
    ${LEADERBOARD_SCOPES.map((scope) => {
      const isSelected = scope === selectedScope;
      return `<button
        type="button"
        class="leaderboard-tab${isSelected ? ' leaderboard-tab-active' : ''}"
        data-command="selectLeaderboardScope"
        data-scope="${scope}"
        role="tab"
        aria-selected="${isSelected ? 'true' : 'false'}"
      >${escapeHtml(leaderboards[scope]?.title ?? formatScopeLabel(scope))}</button>`;
    }).join('')}
  </div>`;
}

function renderLeaderboard(
  leaderboard: LeaderboardView | null,
  currentUserId: string | null
): string {
  if (!leaderboard || leaderboard.entries.length === 0) {
    return '<p class="section-copy">Leaderboard data will appear after students start solving.</p>';
  }

  return `<div class="leaderboard-stack">
    <p class="section-copy">${escapeHtml(leaderboard.formula)}</p>
    <div class="leaderboard-table" role="table" aria-label="${escapeHtml(leaderboard.title)}">
      <div class="leaderboard-head" role="row">
        <span>Rank</span>
        <span>User</span>
        <span>Solved</span>
        <span>Accepted</span>
        <span>Streak</span>
      </div>
      ${leaderboard.entries
        .slice(0, 100)
        .map((entry) => {
          const isCurrentUser = currentUserId !== null && entry.userId === currentUserId;
          return `<div class="leaderboard-row${isCurrentUser ? ' leaderboard-row-current' : ''}" role="row">
            <span class="leaderboard-rank">#${entry.rank}</span>
            <div class="leaderboard-user">
              <strong>${escapeHtml(entry.displayName)}</strong>
              <span>${escapeHtml(entry.scoreLabel)}: ${entry.score}</span>
            </div>
            <span>${entry.solvedCount}</span>
            <span>${entry.acceptedCount}</span>
            <span>${entry.currentStreak}</span>
          </div>`;
        })
        .join('')}
    </div>
  </div>`;
}

export function createAccountViewModel(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  errorMessage?: string | null;
  statsErrorMessage?: string | null;
  isLoadingStats?: boolean;
  stats?: StudentStatsView | null;
  leaderboards?: Partial<Record<LeaderboardScope, LeaderboardView>>;
  selectedLeaderboardScope?: LeaderboardScope;
  recentSubmissions?: readonly SubmissionResult[];
}): AccountViewModel {
  const email = normalizeIdentityField(input.email);
  const role = normalizeIdentityField(input.role);

  if (!input.isAuthenticated || !email || !role) {
    return {
      title: 'Placeholder Practice',
      status: 'Solve problems directly in VS Code.',
      email: '',
      role: '',
      errorMessage: input.errorMessage ?? '',
      statsErrorMessage: '',
      isAuthenticated: false,
      isLoadingStats: false,
      stats: null,
      leaderboards: {},
      selectedLeaderboardScope: 'all-time',
      recentSubmissions: []
    };
  }

  return {
    title: 'Student Profile',
    status: 'A calm overview of your solving progress, streaks, badges, and leaderboard standing.',
    email,
    role,
    errorMessage: input.errorMessage ?? '',
    statsErrorMessage: input.statsErrorMessage ?? '',
    isAuthenticated: true,
    isLoadingStats: input.isLoadingStats ?? false,
    stats: input.stats ?? null,
    leaderboards: input.leaderboards ?? {},
    selectedLeaderboardScope: input.selectedLeaderboardScope ?? 'all-time',
    recentSubmissions: input.recentSubmissions ?? []
  };
}

export function createAccountHtml(input: AccountViewModel): string {
  const title = escapeHtml(input.title);
  const status = escapeHtml(input.status);
  const email = escapeHtml(input.email);
  const role = escapeHtml(input.role);
  const errorMessage = input.errorMessage ? `<p role="alert">${escapeHtml(input.errorMessage)}</p>` : '';
  const statsErrorMessage = input.statsErrorMessage
    ? `<div class="alert-card error-text"><p role="alert">${escapeHtml(input.statsErrorMessage)}</p></div>`
    : '';
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';
  const accountStyles = `
      .account-shell {
        width: min(100%, 580px);
        gap: 20px;
      }

      .account-shell.account-shell-authenticated {
        width: min(100%, 1040px);
      }

      .account-shell .account-intro {
        display: grid;
        gap: 10px;
        justify-items: center;
        text-align: center;
      }

      .account-shell .auth-required-card {
        display: grid;
        gap: 18px;
        padding: 28px 24px;
      }

      .account-shell .account-card-copy,
      .account-shell .profile-copy {
        margin: 0;
        color: var(--text-primary);
        font-size: 1rem;
        line-height: 1.6;
      }

      .account-shell .account-actions {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .account-shell .account-actions vscode-button::part(control),
      .account-shell .account-fallback vscode-button::part(control) {
        justify-content: center;
        min-height: 42px;
      }

      .account-shell .account-helper {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
        max-width: 34ch;
      }

      .account-shell .account-fallback {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
      }

      .account-shell .account-fallback-copy {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .account-shell .account-signed-in {
        gap: 20px;
      }

      .account-shell .profile-hero {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-4);
      }

      .account-shell .profile-hero-main {
        display: flex;
        gap: var(--spacing-3);
        align-items: center;
        min-width: 0;
      }

      .account-shell .profile-avatar {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--vscode-button-background) 18%, var(--surface));
        color: var(--text-primary);
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .account-shell .profile-hero-copy {
        display: grid;
        gap: 6px;
      }

      .account-shell .profile-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .account-shell .profile-pill,
      .account-shell .profile-summary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface-muted);
        color: var(--text-secondary);
      }

      .account-shell .profile-summary {
        display: grid;
        gap: 4px;
        min-width: 190px;
        border-radius: var(--radius);
      }

      .account-shell .stats-layout {
        display: grid;
        gap: var(--spacing-4);
      }

      .account-shell .stats-grid,
      .account-shell .profile-grid,
      .account-shell .chart-grid,
      .account-shell .summary-grid {
        display: grid;
        gap: var(--spacing-3);
      }

      .account-shell .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .account-shell .profile-grid {
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
      }

      .account-shell .chart-grid {
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .account-shell .summary-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .account-shell .metric-card {
        min-height: 112px;
      }

      .account-shell .metric-value-large {
        margin-top: var(--spacing-1);
        font-size: 2.2rem;
        line-height: 1;
        letter-spacing: -0.04em;
        font-weight: 700;
      }

      .account-shell .metric-subvalue {
        margin-top: var(--spacing-2);
        color: var(--text-secondary);
        font-size: 0.92rem;
      }

      .account-shell .activity-card,
      .account-shell .leaderboard-stack {
        display: grid;
        gap: var(--spacing-3);
      }

      .account-shell .activity-grid {
        display: grid;
        grid-template-columns: repeat(20, minmax(0, 1fr));
        gap: 6px;
      }

      .account-shell .activity-cell {
        aspect-ratio: 1;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--surface-muted);
      }

      .account-shell .activity-level-1 {
        background: color-mix(in srgb, var(--vscode-button-background) 16%, var(--surface));
      }

      .account-shell .activity-level-2 {
        background: color-mix(in srgb, var(--vscode-button-background) 28%, var(--surface));
      }

      .account-shell .activity-level-3 {
        background: color-mix(in srgb, var(--vscode-button-background) 42%, var(--surface));
      }

      .account-shell .activity-level-4 {
        background: color-mix(in srgb, var(--vscode-button-background) 56%, var(--surface));
      }

      .account-shell .activity-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        color: var(--text-secondary);
      }

      .account-shell .bar-chart {
        display: grid;
        gap: 12px;
      }

      .account-shell .bar-row {
        display: grid;
        gap: 8px;
      }

      .account-shell .bar-row-copy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .account-shell .bar-track {
        width: 100%;
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--surface-muted);
      }

      .account-shell .bar-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--vscode-button-background) 32%, var(--surface)),
          color-mix(in srgb, var(--vscode-button-background) 68%, var(--surface))
        );
      }

      .account-shell .recent-results-table {
        display: grid;
        gap: 10px;
      }

      .account-shell .recent-results-head,
      .account-shell .recent-results-row {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(90px, 120px) minmax(90px, 120px) minmax(72px, 90px);
        gap: 12px;
        align-items: center;
      }

      .account-shell .recent-results-head {
        color: var(--text-secondary);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .account-shell .recent-results-row {
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
      }

      .account-shell .recent-results-id {
        font-family: var(--font-mono);
      }

      .account-shell .status-pill {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-height: 28px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
      }

      .account-shell .status-ac {
        background: color-mix(in srgb, var(--vscode-testing-iconPassed) 18%, var(--surface));
      }

      .account-shell .status-wa,
      .account-shell .status-re,
      .account-shell .status-ce,
      .account-shell .status-failed {
        background: color-mix(in srgb, var(--vscode-testing-iconFailed) 16%, var(--surface));
      }

      .account-shell .status-running,
      .account-shell .status-queued,
      .account-shell .status-tle {
        background: color-mix(in srgb, var(--vscode-testing-iconQueued) 16%, var(--surface));
      }

      .account-shell .badge-grid {
        display: grid;
        gap: var(--spacing-3);
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .account-shell .badge-chip {
        display: grid;
        gap: 10px;
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }

      .account-shell .badge-earned {
        background: color-mix(in srgb, var(--vscode-button-background) 14%, var(--surface));
      }

      .account-shell .badge-locked {
        opacity: 0.76;
      }

      .account-shell .badge-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .account-shell .badge-title {
        font-weight: 600;
      }

      .account-shell .badge-state,
      .account-shell .badge-copy {
        color: var(--text-secondary);
      }

      .account-shell .leaderboard-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .account-shell .leaderboard-tab {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        color: var(--text-secondary);
        padding: 10px 14px;
        cursor: pointer;
      }

      .account-shell .leaderboard-tab:hover,
      .account-shell .leaderboard-tab-active {
        color: var(--text-primary);
        background: color-mix(in srgb, var(--vscode-button-background) 14%, var(--surface));
      }

      .account-shell .leaderboard-table {
        display: grid;
        gap: 10px;
      }

      .account-shell .leaderboard-head,
      .account-shell .leaderboard-row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1.5fr) 80px 90px 80px;
        gap: 12px;
        align-items: center;
      }

      .account-shell .leaderboard-head {
        color: var(--text-secondary);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .account-shell .leaderboard-row {
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
      }

      .account-shell .leaderboard-row-current {
        background: color-mix(in srgb, var(--vscode-button-background) 16%, var(--surface));
        border-color: color-mix(in srgb, var(--vscode-button-background) 38%, var(--border));
      }

      .account-shell .leaderboard-user {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .account-shell .leaderboard-user span {
        color: var(--text-secondary);
      }

      @media (max-width: 900px) {
        .account-shell .profile-grid {
          grid-template-columns: 1fr;
        }

        .account-shell .recent-results-head,
        .account-shell .recent-results-row,
        .account-shell .leaderboard-head,
        .account-shell .leaderboard-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
  const sharedHead = `    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles({ centered: true })}
      ${accountStyles}
    </style>`;

  if (!input.isAuthenticated) {
    return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell account-shell">
      <div class="account-intro">
        <h2 class="hero-title">${title}</h2>
        <p class="hero-copy">${status}</p>
      </div>
      ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
      <section class="hero-card auth-required-card">
        <p class="account-card-copy">Sign in to sync your account, fetch problems, and submit.</p>
        <div class="account-actions">
          <vscode-button appearance="primary" data-command="signIn">Sign in</vscode-button>
          <vscode-button appearance="secondary" data-command="signUp">Sign up</vscode-button>
        </div>
        <p class="account-helper">Auth opens in your browser and returns automatically.</p>
        <div class="account-fallback">
          <p class="account-fallback-copy">Already have a browser code?</p>
          <vscode-button appearance="secondary" data-command="enterCode">Enter code</vscode-button>
        </div>
      </section>
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command, scope: button.dataset.scope });
        });
      }
    </script>
  </body>
</html>`;
  }

  const stats = input.stats;
  const currentLeaderboard = input.leaderboards[input.selectedLeaderboardScope] ?? null;
  const displayName = stats?.displayName ?? input.email;
  const profileInitials = createInitials(displayName, input.email);

  return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell account-shell account-shell-authenticated">
      <section class="hero-card account-signed-in">
        <div class="profile-hero">
          <div class="profile-hero-main">
            <div class="profile-avatar" aria-hidden="true">${escapeHtml(profileInitials)}</div>
            <div class="profile-hero-copy">
              <p class="eyebrow">Placeholder Practice</p>
              <h2 class="hero-title">${escapeHtml(displayName)}</h2>
              <p class="hero-copy">${status}</p>
              <div class="profile-meta">
                <span class="profile-pill">${email}</span>
                <span class="profile-pill">Role: ${role}</span>
                <span class="profile-pill">${stats?.solvedCount ?? 0} solved</span>
              </div>
            </div>
          </div>
          <div class="profile-summary">
            <p class="section-kicker">Solved summary</p>
            <p class="metric-value-large">${stats?.solvedCount ?? 0}</p>
            <p class="metric-subvalue">${formatPercent(stats?.acceptanceRate ?? 0)} acceptance</p>
          </div>
        </div>
        ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
        ${statsErrorMessage}
        <div class="action-row">
          <vscode-button data-command="logout">Logout</vscode-button>
        </div>
      </section>
      ${
        input.isLoadingStats
          ? `<section class="section-card"><p class="section-copy">Loading your stats...</p></section>`
          : `<div class="stats-layout">
        <div class="profile-grid">
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Solved</p>
              <h3>Solved statistics</h3>
            </div>
            <div class="summary-grid">
              <article class="metric-card">
                <p class="section-kicker">Solved problems</p>
                <p class="metric-value-large">${stats?.solvedCount ?? 0}</p>
                <p class="metric-subvalue">Unique problems solved across your account.</p>
              </article>
              <article class="metric-card">
                <p class="section-kicker">Easy</p>
                <p class="metric-value">${stats?.solvedByDifficulty.find((entry) => entry.key === 'easy')?.count ?? 0}</p>
              </article>
              <article class="metric-card">
                <p class="section-kicker">Medium</p>
                <p class="metric-value">${stats?.solvedByDifficulty.find((entry) => entry.key === 'medium')?.count ?? 0}</p>
              </article>
              <article class="metric-card">
                <p class="section-kicker">Hard</p>
                <p class="metric-value">${stats?.solvedByDifficulty.find((entry) => entry.key === 'hard')?.count ?? 0}</p>
              </article>
            </div>
          </section>
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Activity</p>
              <h3>Activity summary</h3>
            </div>
            ${renderActivitySummary(stats)}
          </section>
        </div>
        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Submissions</p>
            <h3>Submission stats</h3>
          </div>
          <div class="stats-grid">
            <article class="metric-card">
              <p class="section-kicker">Total submissions</p>
              <p class="metric-value-large">${stats?.submissionCount ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Accepted submissions</p>
              <p class="metric-value-large">${stats?.acceptedCount ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Acceptance rate</p>
              <p class="metric-value-large">${formatPercent(stats?.acceptanceRate ?? 0)}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Current streak</p>
              <p class="metric-value-large">${stats?.currentStreak ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Longest streak</p>
              <p class="metric-value-large">${stats?.longestStreak ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Active days</p>
              <p class="metric-value-large">${stats?.activeDays ?? 0}</p>
            </article>
          </div>
        </section>
        <div class="chart-grid">
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Languages</p>
              <h3>Language breakdown</h3>
            </div>
            ${renderBarChart(stats?.languageBreakdown ?? [], 'No language data yet.', 'runs')}
          </section>
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Skills</p>
              <h3>Tag breakdown</h3>
            </div>
            ${renderBarChart(stats?.tagBreakdown ?? [], 'Solve a tagged problem to populate this chart.', 'solves')}
          </section>
        </div>
        <div class="chart-grid">
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Badges</p>
              <h3>Badge display</h3>
            </div>
            ${renderBadges(stats)}
          </section>
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Recent activity</p>
              <h3>Recent judge results</h3>
            </div>
            ${renderRecentActivity(input.recentSubmissions)}
          </section>
        </div>
        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Leaderboards</p>
            <h3>Leaderboard</h3>
          </div>
          ${renderLeaderboardTabs(input.leaderboards, input.selectedLeaderboardScope)}
          ${renderLeaderboard(currentLeaderboard, stats?.userId ?? null)}
        </section>
      </div>`
      }
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command, scope: button.dataset.scope });
        });
      }
    </script>
  </body>
</html>`;
}
