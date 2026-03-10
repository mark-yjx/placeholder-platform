export type StatsLeaderboardScope = 'all-time' | 'weekly' | 'monthly' | 'streak';

export type StatsBadgeId = 'first_ac' | 'solved_10' | 'solved_50' | 'streak_7' | 'streak_30';

export type StatsBreakdownEntry = {
  key: string;
  count: number;
};

export type StatsBadgeView = {
  id: StatsBadgeId;
  title: string;
  description: string;
  earned: boolean;
};

export type StudentStatsView = {
  userId: string;
  displayName: string;
  solvedCount: number;
  solvedByDifficulty: readonly StatsBreakdownEntry[];
  submissionCount: number;
  acceptedCount: number;
  acceptanceRate: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  languageBreakdown: readonly StatsBreakdownEntry[];
  tagBreakdown: readonly StatsBreakdownEntry[];
  badges: readonly StatsBadgeView[];
};

export type LeaderboardEntryView = {
  rank: number;
  userId: string;
  displayName: string;
  solvedCount: number;
  acceptedCount: number;
  submissionCount: number;
  currentStreak: number;
  longestStreak: number;
  score: number;
  scoreLabel: string;
};

export type LeaderboardView = {
  scope: StatsLeaderboardScope;
  title: string;
  formula: string;
  generatedAt: string;
  windowStart?: string;
  windowEnd?: string;
  entries: readonly LeaderboardEntryView[];
};

export type AdminAnalyticsOverviewView = {
  totalUsers: number;
  activeUsers: number;
  activeWindowDays: number;
  totalSubmissions: number;
  totalAcceptedSubmissions: number;
  uniqueProblemSolves: number;
};

export type StatsPlatformUser = {
  userId: string;
  displayName: string;
  role: 'student' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
};

export type StatsSubmissionFact = {
  submissionId: string;
  userId: string;
  problemId: string;
  language: string;
  createdAt: string;
  verdict?: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | null;
  difficulty?: string | null;
  tags?: unknown;
};

export interface StatsRankingRepository {
  listPlatformUsers(): Promise<readonly StatsPlatformUser[]>;
  listSubmissionFacts(): Promise<readonly StatsSubmissionFact[]>;
}

export interface StatsSqlClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
}

type SolvedProblemFact = {
  problemId: string;
  solvedAt: string;
  difficulty: string;
  tags: readonly string[];
};

type InternalUserStats = StudentStatsView & {
  createdAt: string;
  status: 'active' | 'disabled';
  weeklySolvedCount: number;
  weeklyAcceptedCount: number;
  weeklySubmissionCount: number;
  monthlySolvedCount: number;
  monthlyAcceptedCount: number;
  monthlySubmissionCount: number;
};

type Snapshot = {
  generatedAt: string;
  studentStats: ReadonlyMap<string, InternalUserStats>;
  studentUsers: readonly StatsPlatformUser[];
  allUsers: readonly StatsPlatformUser[];
  submissions: readonly StatsSubmissionFact[];
  windows: {
    weekly: { start: string; end: string };
    monthly: { start: string; end: string };
  };
};

const LIST_PLATFORM_USERS_SQL = `
SELECT
  id AS user_id,
  display_name,
  role,
  status,
  created_at
FROM users
ORDER BY created_at ASC, id ASC
`;

const LIST_SUBMISSION_FACTS_SQL = `
SELECT
  s.id AS submission_id,
  s.user_id,
  s.problem_id,
  s.language,
  s.created_at,
  jr.verdict,
  pva.difficulty,
  pva.tags
FROM submissions s
LEFT JOIN judge_results jr
  ON jr.submission_id = s.id
LEFT JOIN problem_version_assets pva
  ON pva.problem_version_id = s.problem_version_id
ORDER BY s.created_at ASC, s.id ASC
`;

const ACTIVE_USERS_WINDOW_DAYS = 30;

const BADGES: readonly Omit<StatsBadgeView, 'earned'>[] = [
  {
    id: 'first_ac',
    title: 'First AC',
    description: 'Earn your first accepted submission.'
  },
  {
    id: 'solved_10',
    title: 'Solved 10',
    description: 'Solve 10 unique problems.'
  },
  {
    id: 'solved_50',
    title: 'Solved 50',
    description: 'Solve 50 unique problems.'
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Stay active for 7 consecutive days.'
  },
  {
    id: 'streak_30',
    title: '30-Day Streak',
    description: 'Stay active for 30 consecutive days.'
  }
] as const;

function toUtcDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function toDayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00.000Z`) / 86_400_000);
}

function roundRate(value: number): number {
  return Number(value.toFixed(1));
}

function sortBreakdown(entries: Map<string, number>): readonly StatsBreakdownEntry[] {
  return Array.from(entries.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.key.localeCompare(right.key);
    });
}

function sortDifficultyBreakdown(entries: Map<string, number>): readonly StatsBreakdownEntry[] {
  const order = new Map<string, number>([
    ['easy', 0],
    ['medium', 1],
    ['hard', 2],
    ['unknown', 3]
  ]);

  return Array.from(entries.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      const leftOrder = order.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.key) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.key.localeCompare(right.key);
    });
}

function normalizeDifficulty(value?: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || 'unknown';
}

function normalizeTags(value: unknown): readonly string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
      : [];
  const tags = source
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  if (tags.length === 0) {
    return ['untagged'];
  }

  return Array.from(new Set(tags.values())).sort((left, right) => left.localeCompare(right));
}

function computeStreaks(days: readonly string[], now: Date): {
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
} {
  if (days.length === 0) {
    return { activeDays: 0, currentStreak: 0, longestStreak: 0 };
  }

  const sorted = Array.from(new Set(days.values())).sort((left, right) => left.localeCompare(right));
  let longest = 1;
  let currentRun = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = toDayNumber(sorted[index - 1] as string);
    const current = toDayNumber(sorted[index] as string);
    if (current - previous === 1) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
      continue;
    }
    currentRun = 1;
  }

  const today = toUtcDay(now);
  const yesterday = toUtcDay(new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  )));
  const lastDay = sorted[sorted.length - 1] as string;

  if (lastDay !== today && lastDay !== yesterday) {
    return {
      activeDays: sorted.length,
      currentStreak: 0,
      longestStreak: longest
    };
  }

  let currentStreak = 1;
  for (let index = sorted.length - 1; index > 0; index -= 1) {
    const current = toDayNumber(sorted[index] as string);
    const previous = toDayNumber(sorted[index - 1] as string);
    if (current - previous !== 1) {
      break;
    }
    currentStreak += 1;
  }

  return {
    activeDays: sorted.length,
    currentStreak,
    longestStreak: longest
  };
}

function buildBadgeViews(stats: Pick<StudentStatsView, 'acceptedCount' | 'solvedCount' | 'longestStreak'>): readonly StatsBadgeView[] {
  return BADGES.map((badge) => ({
    ...badge,
    earned:
      (badge.id === 'first_ac' && stats.acceptedCount >= 1) ||
      (badge.id === 'solved_10' && stats.solvedCount >= 10) ||
      (badge.id === 'solved_50' && stats.solvedCount >= 50) ||
      (badge.id === 'streak_7' && stats.longestStreak >= 7) ||
      (badge.id === 'streak_30' && stats.longestStreak >= 30)
  }));
}

function isWithinWindow(timestamp: string, start: Date, end: Date): boolean {
  const value = Date.parse(timestamp);
  return value >= start.getTime() && value < end.getTime();
}

function startOfUtcWeek(now: Date): Date {
  const day = now.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatWindow(start: Date, end: Date): { start: string; end: string } {
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function compareCreatedAt(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.localeCompare(right);
}

export class PostgresStatsRankingRepository implements StatsRankingRepository {
  constructor(private readonly sqlClient: StatsSqlClient) {}

  async listPlatformUsers(): Promise<readonly StatsPlatformUser[]> {
    const rows = await this.sqlClient.query<{
      user_id: string;
      display_name: string;
      role: 'student' | 'admin';
      status: 'active' | 'disabled';
      created_at: string;
    }>(LIST_PLATFORM_USERS_SQL);

    return rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at
    }));
  }

  async listSubmissionFacts(): Promise<readonly StatsSubmissionFact[]> {
    const rows = await this.sqlClient.query<{
      submission_id: string;
      user_id: string;
      problem_id: string;
      language: string;
      created_at: string;
      verdict?: StatsSubmissionFact['verdict'];
      difficulty?: string | null;
      tags?: unknown;
    }>(LIST_SUBMISSION_FACTS_SQL);

    return rows.map((row) => ({
      submissionId: row.submission_id,
      userId: row.user_id,
      problemId: row.problem_id,
      language: row.language,
      createdAt: row.created_at,
      verdict: row.verdict ?? null,
      difficulty: row.difficulty ?? null,
      tags: row.tags
    }));
  }
}

export class StatsRankingService {
  constructor(
    private readonly repository: StatsRankingRepository,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async getStudentStats(userId: string): Promise<StudentStatsView> {
    const snapshot = await this.buildSnapshot();
    const stats = snapshot.studentStats.get(userId);
    if (stats) {
      return stripInternalStats(stats);
    }

    const fallbackUser = snapshot.allUsers.find((candidate) => candidate.userId === userId);
    return {
      userId,
      displayName: fallbackUser?.displayName ?? userId,
      solvedCount: 0,
      solvedByDifficulty: [],
      submissionCount: 0,
      acceptedCount: 0,
      acceptanceRate: 0,
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      languageBreakdown: [],
      tagBreakdown: [],
      badges: buildBadgeViews({
        acceptedCount: 0,
        solvedCount: 0,
        longestStreak: 0
      })
    };
  }

  async getLeaderboard(scope: StatsLeaderboardScope): Promise<LeaderboardView> {
    const snapshot = await this.buildSnapshot();
    const eligible = Array.from(snapshot.studentStats.values()).filter(
      (candidate) => candidate.status === 'active' && candidate.submissionCount > 0
    );
    const generatedAt = snapshot.generatedAt;

    if (scope === 'all-time') {
      const entries = eligible
        .sort((left, right) => {
          if (right.solvedCount !== left.solvedCount) {
            return right.solvedCount - left.solvedCount;
          }
          if (right.acceptedCount !== left.acceptedCount) {
            return right.acceptedCount - left.acceptedCount;
          }
          if (left.submissionCount !== right.submissionCount) {
            return left.submissionCount - right.submissionCount;
          }
          const createdAtComparison = compareCreatedAt(left.createdAt, right.createdAt);
          if (createdAtComparison !== 0) {
            return createdAtComparison;
          }
          return left.userId.localeCompare(right.userId);
        })
        .map((entry, index) => toLeaderboardEntry(index + 1, entry, entry.solvedCount, 'Solved'));

      return {
        scope,
        title: 'All-Time Leaderboard',
        formula: 'Ranked by solvedCount desc, acceptedCount desc, submissionCount asc, createdAt asc, userId asc.',
        generatedAt,
        entries
      };
    }

    if (scope === 'weekly') {
      const entries = eligible
        .sort((left, right) => {
          if (right.weeklySolvedCount !== left.weeklySolvedCount) {
            return right.weeklySolvedCount - left.weeklySolvedCount;
          }
          if (right.weeklyAcceptedCount !== left.weeklyAcceptedCount) {
            return right.weeklyAcceptedCount - left.weeklyAcceptedCount;
          }
          if (left.weeklySubmissionCount !== right.weeklySubmissionCount) {
            return left.weeklySubmissionCount - right.weeklySubmissionCount;
          }
          const createdAtComparison = compareCreatedAt(left.createdAt, right.createdAt);
          if (createdAtComparison !== 0) {
            return createdAtComparison;
          }
          return left.userId.localeCompare(right.userId);
        })
        .map((entry, index) =>
          toLeaderboardEntry(index + 1, entry, entry.weeklySolvedCount, 'Solved this week')
        );

      return {
        scope,
        title: 'Weekly Leaderboard',
        formula:
          'Ranked by unique problems first solved this UTC week, accepted submissions in-window desc, total submissions in-window asc, createdAt asc, userId asc.',
        generatedAt,
        windowStart: snapshot.windows.weekly.start,
        windowEnd: snapshot.windows.weekly.end,
        entries
      };
    }

    if (scope === 'monthly') {
      const entries = eligible
        .sort((left, right) => {
          if (right.monthlySolvedCount !== left.monthlySolvedCount) {
            return right.monthlySolvedCount - left.monthlySolvedCount;
          }
          if (right.monthlyAcceptedCount !== left.monthlyAcceptedCount) {
            return right.monthlyAcceptedCount - left.monthlyAcceptedCount;
          }
          if (left.monthlySubmissionCount !== right.monthlySubmissionCount) {
            return left.monthlySubmissionCount - right.monthlySubmissionCount;
          }
          const createdAtComparison = compareCreatedAt(left.createdAt, right.createdAt);
          if (createdAtComparison !== 0) {
            return createdAtComparison;
          }
          return left.userId.localeCompare(right.userId);
        })
        .map((entry, index) =>
          toLeaderboardEntry(index + 1, entry, entry.monthlySolvedCount, 'Solved this month')
        );

      return {
        scope,
        title: 'Monthly Leaderboard',
        formula:
          'Ranked by unique problems first solved this UTC month, accepted submissions in-window desc, total submissions in-window asc, createdAt asc, userId asc.',
        generatedAt,
        windowStart: snapshot.windows.monthly.start,
        windowEnd: snapshot.windows.monthly.end,
        entries
      };
    }

    const entries = eligible
      .sort((left, right) => {
        if (right.currentStreak !== left.currentStreak) {
          return right.currentStreak - left.currentStreak;
        }
        if (right.longestStreak !== left.longestStreak) {
          return right.longestStreak - left.longestStreak;
        }
        if (right.solvedCount !== left.solvedCount) {
          return right.solvedCount - left.solvedCount;
        }
        const createdAtComparison = compareCreatedAt(left.createdAt, right.createdAt);
        if (createdAtComparison !== 0) {
          return createdAtComparison;
        }
        return left.userId.localeCompare(right.userId);
      })
      .map((entry, index) => toLeaderboardEntry(index + 1, entry, entry.currentStreak, 'Current streak'));

    return {
      scope,
      title: 'Streak Leaderboard',
      formula:
        'Ranked by currentStreak desc, longestStreak desc, solvedCount desc, createdAt asc, userId asc.',
      generatedAt,
      entries
    };
  }

  async getAdminOverview(): Promise<AdminAnalyticsOverviewView> {
    const snapshot = await this.buildSnapshot();
    const activeWindowStart = addUtcDays(this.nowProvider(), -ACTIVE_USERS_WINDOW_DAYS);
    const activeUsers = new Set<string>();

    for (const submission of snapshot.submissions) {
      if (!snapshot.studentStats.has(submission.userId)) {
        continue;
      }
      if (Date.parse(submission.createdAt) >= activeWindowStart.getTime()) {
        activeUsers.add(submission.userId);
      }
    }

    let uniqueProblemSolves = 0;
    for (const stats of snapshot.studentStats.values()) {
      uniqueProblemSolves += stats.solvedCount;
    }

    return {
      totalUsers: snapshot.allUsers.length,
      activeUsers: activeUsers.size,
      activeWindowDays: ACTIVE_USERS_WINDOW_DAYS,
      totalSubmissions: snapshot.submissions.length,
      totalAcceptedSubmissions: snapshot.submissions.filter((submission) => submission.verdict === 'AC').length,
      uniqueProblemSolves
    };
  }

  private async buildSnapshot(): Promise<Snapshot> {
    const [users, submissions] = await Promise.all([
      this.repository.listPlatformUsers(),
      this.repository.listSubmissionFacts()
    ]);
    const now = this.nowProvider();
    const generatedAt = now.toISOString();
    const weekStart = startOfUtcWeek(now);
    const weekEnd = addUtcDays(weekStart, 7);
    const monthStart = startOfUtcMonth(now);
    const monthEnd = addUtcMonths(monthStart, 1);
    const studentUsers = users.filter((user) => user.role === 'student');
    const studentUserIds = new Set(studentUsers.map((user) => user.userId));
    const studentSubmissions = submissions.filter((submission) => studentUserIds.has(submission.userId));
    const submissionsByUser = new Map<string, StatsSubmissionFact[]>();

    for (const submission of studentSubmissions) {
      const current = submissionsByUser.get(submission.userId) ?? [];
      current.push(submission);
      submissionsByUser.set(submission.userId, current);
    }

    const studentStats = new Map<string, InternalUserStats>();
    for (const user of studentUsers) {
      const userSubmissions = submissionsByUser.get(user.userId) ?? [];
      studentStats.set(user.userId, this.computeUserStats(user, userSubmissions, {
        now,
        weekly: { start: weekStart, end: weekEnd },
        monthly: { start: monthStart, end: monthEnd }
      }));
    }

    return {
      generatedAt,
      studentStats,
      studentUsers,
      allUsers: users,
      submissions: studentSubmissions,
      windows: {
        weekly: formatWindow(weekStart, weekEnd),
        monthly: formatWindow(monthStart, monthEnd)
      }
    };
  }

  private computeUserStats(
    user: StatsPlatformUser,
    submissions: readonly StatsSubmissionFact[],
    windows: {
      now: Date;
      weekly: { start: Date; end: Date };
      monthly: { start: Date; end: Date };
    }
  ): InternalUserStats {
    const activeDays = submissions.map((submission) => toUtcDay(submission.createdAt));
    const streaks = computeStreaks(activeDays, windows.now);
    const accepted = submissions.filter((submission) => submission.verdict === 'AC');
    const firstSolvedByProblem = new Map<string, SolvedProblemFact>();
    const languageBreakdown = new Map<string, number>();

    for (const submission of submissions) {
      const language = submission.language.trim().toLowerCase() || 'unknown';
      languageBreakdown.set(language, (languageBreakdown.get(language) ?? 0) + 1);
    }

    for (const submission of accepted) {
      if (firstSolvedByProblem.has(submission.problemId)) {
        continue;
      }
      firstSolvedByProblem.set(submission.problemId, {
        problemId: submission.problemId,
        solvedAt: submission.createdAt,
        difficulty: normalizeDifficulty(submission.difficulty),
        tags: normalizeTags(submission.tags)
      });
    }

    const solvedByDifficulty = new Map<string, number>();
    const tagBreakdown = new Map<string, number>();

    for (const solved of firstSolvedByProblem.values()) {
      solvedByDifficulty.set(solved.difficulty, (solvedByDifficulty.get(solved.difficulty) ?? 0) + 1);
      for (const tag of solved.tags) {
        tagBreakdown.set(tag, (tagBreakdown.get(tag) ?? 0) + 1);
      }
    }

    const weeklySolvedCount = Array.from(firstSolvedByProblem.values()).filter((solved) =>
      isWithinWindow(solved.solvedAt, windows.weekly.start, windows.weekly.end)
    ).length;
    const monthlySolvedCount = Array.from(firstSolvedByProblem.values()).filter((solved) =>
      isWithinWindow(solved.solvedAt, windows.monthly.start, windows.monthly.end)
    ).length;
    const weeklyAcceptedCount = accepted.filter((submission) =>
      isWithinWindow(submission.createdAt, windows.weekly.start, windows.weekly.end)
    ).length;
    const monthlyAcceptedCount = accepted.filter((submission) =>
      isWithinWindow(submission.createdAt, windows.monthly.start, windows.monthly.end)
    ).length;
    const weeklySubmissionCount = submissions.filter((submission) =>
      isWithinWindow(submission.createdAt, windows.weekly.start, windows.weekly.end)
    ).length;
    const monthlySubmissionCount = submissions.filter((submission) =>
      isWithinWindow(submission.createdAt, windows.monthly.start, windows.monthly.end)
    ).length;
    const submissionCount = submissions.length;
    const acceptedCount = accepted.length;
    const solvedCount = firstSolvedByProblem.size;
    const statsWithoutBadges = {
      userId: user.userId,
      displayName: user.displayName,
      solvedCount,
      solvedByDifficulty: sortDifficultyBreakdown(solvedByDifficulty),
      submissionCount,
      acceptedCount,
      acceptanceRate: submissionCount === 0 ? 0 : roundRate((acceptedCount / submissionCount) * 100),
      activeDays: streaks.activeDays,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      languageBreakdown: sortBreakdown(languageBreakdown),
      tagBreakdown: sortBreakdown(tagBreakdown)
    } satisfies Omit<StudentStatsView, 'badges'>;

    return {
      ...statsWithoutBadges,
      badges: buildBadgeViews({
        acceptedCount,
        solvedCount,
        longestStreak: streaks.longestStreak
      }),
      createdAt: user.createdAt,
      status: user.status,
      weeklySolvedCount,
      weeklyAcceptedCount,
      weeklySubmissionCount,
      monthlySolvedCount,
      monthlyAcceptedCount,
      monthlySubmissionCount
    };
  }
}

function stripInternalStats(stats: InternalUserStats): StudentStatsView {
  return {
    userId: stats.userId,
    displayName: stats.displayName,
    solvedCount: stats.solvedCount,
    solvedByDifficulty: stats.solvedByDifficulty,
    submissionCount: stats.submissionCount,
    acceptedCount: stats.acceptedCount,
    acceptanceRate: stats.acceptanceRate,
    activeDays: stats.activeDays,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    languageBreakdown: stats.languageBreakdown,
    tagBreakdown: stats.tagBreakdown,
    badges: stats.badges
  };
}

function toLeaderboardEntry(
  rank: number,
  entry: InternalUserStats,
  score: number,
  scoreLabel: string
): LeaderboardEntryView {
  return {
    rank,
    userId: entry.userId,
    displayName: entry.displayName,
    solvedCount: entry.solvedCount,
    acceptedCount: entry.acceptedCount,
    submissionCount: entry.submissionCount,
    currentStreak: entry.currentStreak,
    longestStreak: entry.longestStreak,
    score,
    scoreLabel
  };
}
