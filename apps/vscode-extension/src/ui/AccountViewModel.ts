import { LeaderboardView, StatsBreakdownView, StudentStatsView } from '../api/EngagementApiClient';
import { createWebviewStyles, escapeHtml } from './WebviewTheme';

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
  leaderboard: LeaderboardView | null;
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

function renderBreakdownList(entries: readonly StatsBreakdownView[], emptyMessage: string): string {
  if (entries.length === 0) {
    return `<p class="section-copy">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="breakdown-list">
    ${entries
      .map(
        (entry) => `<div class="breakdown-row">
      <span>${escapeHtml(formatLabel(entry.key))}</span>
      <strong>${entry.count}</strong>
    </div>`
      )
      .join('')}
  </div>`;
}

function renderBadges(stats: StudentStatsView | null): string {
  if (!stats) {
    return '<p class="section-copy">Sign in to unlock badges.</p>';
  }

  return `<div class="badge-grid">
    ${stats.badges
      .map(
        (badge) => `<article class="badge-chip ${badge.earned ? 'badge-earned' : 'badge-locked'}">
      <p class="badge-title">${escapeHtml(badge.title)}</p>
      <p class="badge-copy">${escapeHtml(badge.description)}</p>
    </article>`
      )
      .join('')}
  </div>`;
}

function renderLeaderboard(leaderboard: LeaderboardView | null): string {
  if (!leaderboard || leaderboard.entries.length === 0) {
    return '<p class="section-copy">No leaderboard activity yet.</p>';
  }

  return `<div class="leaderboard-stack">
    <p class="section-copy">${escapeHtml(leaderboard.formula)}</p>
    <div class="leaderboard-table">
      ${leaderboard.entries
        .map(
          (entry) => `<div class="leaderboard-row">
        <span class="leaderboard-rank">#${entry.rank}</span>
        <div class="leaderboard-meta">
          <strong>${escapeHtml(entry.displayName)}</strong>
          <span>${escapeHtml(entry.scoreLabel)}: ${entry.score}</span>
        </div>
        <span class="leaderboard-stats">Solved ${entry.solvedCount}</span>
      </div>`
        )
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
  leaderboard?: LeaderboardView | null;
}): AccountViewModel {
  const email = normalizeIdentityField(input.email);
  const role = normalizeIdentityField(input.role);

  if (!input.isAuthenticated || !email || !role) {
    return {
      title: 'OJ Practice',
      status: 'Solve problems directly in VS Code.',
      email: '',
      role: '',
      errorMessage: input.errorMessage ?? '',
      statsErrorMessage: '',
      isAuthenticated: false,
      isLoadingStats: false,
      stats: null,
      leaderboard: null
    };
  }

  return {
    title: 'Your Progress',
    status: 'Track solved problems, streaks, badges, and the current all-time leaderboard.',
    email,
    role,
    errorMessage: input.errorMessage ?? '',
    statsErrorMessage: input.statsErrorMessage ?? '',
    isAuthenticated: true,
    isLoadingStats: input.isLoadingStats ?? false,
    stats: input.stats ?? null,
    leaderboard: input.leaderboard ?? null
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
        width: min(100%, 920px);
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

      .account-shell .account-card-copy {
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
        gap: 18px;
      }

      .account-shell .stats-grid {
        display: grid;
        gap: var(--spacing-3);
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .account-shell .stats-layout {
        display: grid;
        gap: var(--spacing-4);
      }

      .account-shell .stats-layout .dual-grid {
        display: grid;
        gap: var(--spacing-4);
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .account-shell .breakdown-list,
      .account-shell .leaderboard-table {
        display: grid;
        gap: var(--spacing-2);
      }

      .account-shell .breakdown-row,
      .account-shell .leaderboard-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-3);
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
      }

      .account-shell .leaderboard-meta {
        display: grid;
        gap: 4px;
        min-width: 0;
        flex: 1 1 auto;
      }

      .account-shell .leaderboard-meta span,
      .account-shell .leaderboard-stats,
      .account-shell .badge-copy {
        color: var(--text-secondary);
      }

      .account-shell .leaderboard-rank {
        min-width: 40px;
        font-weight: 600;
      }

      .account-shell .badge-grid {
        display: grid;
        gap: var(--spacing-3);
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .account-shell .badge-chip {
        display: grid;
        gap: 6px;
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }

      .account-shell .badge-earned {
        background: var(--surface-muted);
      }

      .account-shell .badge-locked {
        opacity: 0.72;
      }

      .account-shell .badge-title {
        font-weight: 600;
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
      for (const button of document.querySelectorAll('vscode-button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
  }

  const stats = input.stats;
  const leaderboard = input.leaderboard;

  return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell account-shell account-shell-authenticated">
      <section class="hero-card account-signed-in">
        <p class="eyebrow">OJ Practice</p>
        <h2 class="hero-title">${title}</h2>
        <p class="hero-copy">${status}</p>
        ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
        ${statsErrorMessage}
        <div class="inline-meta">
          <p>Logged in as <strong>${email}</strong></p>
          <p>Role: <code>${role}</code></p>
        </div>
        <div class="action-row">
          <vscode-button data-command="logout">Logout</vscode-button>
        </div>
      </section>
      ${
        input.isLoadingStats
          ? `<section class="section-card"><p class="section-copy">Loading your stats...</p></section>`
          : `<div class="stats-layout">
        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Snapshot</p>
            <h3>Current progress</h3>
          </div>
          <div class="stats-grid">
            <article class="metric-card">
              <p class="section-kicker">Solved</p>
              <p class="metric-value">${stats?.solvedCount ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Accepted</p>
              <p class="metric-value">${stats?.acceptedCount ?? 0} / ${stats?.submissionCount ?? 0}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Acceptance</p>
              <p class="metric-value">${formatPercent(stats?.acceptanceRate ?? 0)}</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Current streak</p>
              <p class="metric-value">${stats?.currentStreak ?? 0} days</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Longest streak</p>
              <p class="metric-value">${stats?.longestStreak ?? 0} days</p>
            </article>
            <article class="metric-card">
              <p class="section-kicker">Active days</p>
              <p class="metric-value">${stats?.activeDays ?? 0}</p>
            </article>
          </div>
        </section>
        <div class="dual-grid">
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Solved by difficulty</p>
              <h3>Difficulty breakdown</h3>
            </div>
            ${renderBreakdownList(stats?.solvedByDifficulty ?? [], 'No solved problems yet.')}
          </section>
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Languages</p>
              <h3>Submission breakdown</h3>
            </div>
            ${renderBreakdownList(stats?.languageBreakdown ?? [], 'No submission data yet.')}
          </section>
        </div>
        <div class="dual-grid">
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Tags</p>
              <h3>Solved topics</h3>
            </div>
            ${renderBreakdownList(stats?.tagBreakdown ?? [], 'Solve a tagged problem to populate this list.')}
          </section>
          <section class="section-card">
            <div class="section-header">
              <p class="section-kicker">Badges</p>
              <h3>Milestones</h3>
            </div>
            ${renderBadges(stats)}
          </section>
        </div>
        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Leaderboard</p>
            <h3>${escapeHtml(leaderboard?.title ?? 'All-Time Leaderboard')}</h3>
          </div>
          ${renderLeaderboard(leaderboard)}
        </section>
      </div>`
      }
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('vscode-button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}
