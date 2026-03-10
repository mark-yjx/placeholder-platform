import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StatsRankingRepository,
  StatsRankingService,
  StatsSubmissionFact,
  StatsPlatformUser
} from '../stats/StatsRankingService';

class FakeStatsRepository implements StatsRankingRepository {
  constructor(
    private readonly users: readonly StatsPlatformUser[],
    private readonly submissions: readonly StatsSubmissionFact[]
  ) {}

  async listPlatformUsers(): Promise<readonly StatsPlatformUser[]> {
    return this.users;
  }

  async listSubmissionFacts(): Promise<readonly StatsSubmissionFact[]> {
    return this.submissions;
  }
}

const users: readonly StatsPlatformUser[] = [
  {
    userId: 'admin-1',
    displayName: 'Platform Admin',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z'
  },
  {
    userId: 'student-1',
    displayName: 'Student One',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-02T08:00:00.000Z'
  },
  {
    userId: 'student-2',
    displayName: 'Student Two',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-03T08:00:00.000Z'
  },
  {
    userId: 'student-3',
    displayName: 'Student Disabled',
    role: 'student',
    status: 'disabled',
    createdAt: '2026-01-04T08:00:00.000Z'
  },
  {
    userId: 'student-4',
    displayName: 'Student Four',
    role: 'student',
    status: 'active',
    createdAt: '2026-01-05T08:00:00.000Z'
  }
];

const submissions: readonly StatsSubmissionFact[] = [
  {
    submissionId: 's1',
    userId: 'student-1',
    problemId: 'easy-a',
    language: 'python',
    createdAt: '2026-03-01T09:00:00.000Z',
    verdict: 'WA',
    difficulty: 'easy',
    tags: ['array', 'math']
  },
  {
    submissionId: 's2',
    userId: 'student-1',
    problemId: 'easy-a',
    language: 'python',
    createdAt: '2026-03-02T09:00:00.000Z',
    verdict: 'AC',
    difficulty: 'easy',
    tags: ['array', 'math']
  },
  {
    submissionId: 's3',
    userId: 'student-1',
    problemId: 'easy-a',
    language: 'python',
    createdAt: '2026-03-03T09:00:00.000Z',
    verdict: 'AC',
    difficulty: 'easy',
    tags: ['array', 'math']
  },
  {
    submissionId: 's4',
    userId: 'student-1',
    problemId: 'hard-a',
    language: 'python',
    createdAt: '2026-03-04T09:00:00.000Z',
    verdict: 'AC',
    difficulty: 'hard',
    tags: ['dp']
  },
  {
    submissionId: 's5',
    userId: 'student-1',
    problemId: 'medium-a',
    language: 'python',
    createdAt: '2026-03-09T09:00:00.000Z',
    verdict: 'WA',
    difficulty: 'medium',
    tags: ['graphs']
  },
  {
    submissionId: 's6',
    userId: 'student-1',
    problemId: 'medium-a',
    language: 'python',
    createdAt: '2026-03-10T09:00:00.000Z',
    verdict: 'AC',
    difficulty: 'medium',
    tags: ['graphs', 'bfs']
  },
  {
    submissionId: 't1',
    userId: 'student-2',
    problemId: 'easy-b',
    language: 'python',
    createdAt: '2026-03-09T10:00:00.000Z',
    verdict: 'AC',
    difficulty: 'easy',
    tags: ['array']
  },
  {
    submissionId: 't2',
    userId: 'student-2',
    problemId: 'medium-b',
    language: 'python',
    createdAt: '2026-03-10T10:00:00.000Z',
    verdict: 'WA',
    difficulty: 'medium',
    tags: ['graph']
  },
  {
    submissionId: 't3',
    userId: 'student-2',
    problemId: 'medium-b',
    language: 'python',
    createdAt: '2026-03-10T10:10:00.000Z',
    verdict: 'AC',
    difficulty: 'medium',
    tags: ['graph']
  },
  {
    submissionId: 't4',
    userId: 'student-2',
    problemId: 'unknown-b',
    language: 'python',
    createdAt: '2026-03-10T10:20:00.000Z',
    verdict: 'AC',
    difficulty: null,
    tags: null
  },
  {
    submissionId: 'd1',
    userId: 'student-3',
    problemId: 'hard-disabled',
    language: 'python',
    createdAt: '2026-03-10T11:00:00.000Z',
    verdict: 'AC',
    difficulty: 'hard',
    tags: ['math']
  },
  {
    submissionId: 'u1',
    userId: 'student-4',
    problemId: 'easy-c',
    language: 'python',
    createdAt: '2026-03-09T12:00:00.000Z',
    verdict: 'AC',
    difficulty: 'easy',
    tags: ['array']
  },
  {
    submissionId: 'u2',
    userId: 'student-4',
    problemId: 'medium-c',
    language: 'python',
    createdAt: '2026-03-10T12:00:00.000Z',
    verdict: 'WA',
    difficulty: 'medium',
    tags: ['graph']
  },
  {
    submissionId: 'u3',
    userId: 'student-4',
    problemId: 'medium-c',
    language: 'python',
    createdAt: '2026-03-10T12:10:00.000Z',
    verdict: 'AC',
    difficulty: 'medium',
    tags: ['graph']
  },
  {
    submissionId: 'u4',
    userId: 'student-4',
    problemId: 'unknown-c',
    language: 'python',
    createdAt: '2026-03-10T12:20:00.000Z',
    verdict: 'AC',
    difficulty: null,
    tags: null
  }
];

function createService(): StatsRankingService {
  return new StatsRankingService(
    new FakeStatsRepository(users, submissions),
    () => new Date('2026-03-10T13:00:00.000Z')
  );
}

test('student stats count unique solves, acceptance, streaks, languages, tags, and badges deterministically', async () => {
  const service = createService();
  const stats = await service.getStudentStats('student-1');

  assert.equal(stats.userId, 'student-1');
  assert.equal(stats.displayName, 'Student One');
  assert.equal(stats.solvedCount, 3);
  assert.equal(stats.submissionCount, 6);
  assert.equal(stats.acceptedCount, 4);
  assert.equal(stats.acceptanceRate, 66.7);
  assert.equal(stats.activeDays, 6);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.longestStreak, 4);
  assert.deepEqual(stats.solvedByDifficulty, [
    { key: 'easy', count: 1 },
    { key: 'medium', count: 1 },
    { key: 'hard', count: 1 }
  ]);
  assert.deepEqual(stats.languageBreakdown, [{ key: 'python', count: 6 }]);
  assert.deepEqual(stats.tagBreakdown, [
    { key: 'array', count: 1 },
    { key: 'bfs', count: 1 },
    { key: 'dp', count: 1 },
    { key: 'graphs', count: 1 },
    { key: 'math', count: 1 }
  ]);
  assert.deepEqual(
    stats.badges.map((badge) => [badge.id, badge.earned]),
    [
      ['first_ac', true],
      ['solved_10', false],
      ['solved_50', false],
      ['streak_7', false],
      ['streak_30', false]
    ]
  );
});

test('student stats group missing difficulty and tags predictably', async () => {
  const service = createService();
  const stats = await service.getStudentStats('student-2');

  assert.deepEqual(stats.solvedByDifficulty, [
    { key: 'easy', count: 1 },
    { key: 'medium', count: 1 },
    { key: 'unknown', count: 1 }
  ]);
  assert.deepEqual(stats.tagBreakdown, [
    { key: 'array', count: 1 },
    { key: 'graph', count: 1 },
    { key: 'untagged', count: 1 }
  ]);
});

test('leaderboards use documented formulas, stable windows, and deterministic tie-breaking', async () => {
  const service = createService();

  const allTime = await service.getLeaderboard('all-time');
  assert.equal(allTime.scope, 'all-time');
  assert.match(allTime.formula, /solvedCount desc/i);
  assert.deepEqual(
    allTime.entries.map((entry) => [entry.rank, entry.userId, entry.score]),
    [
      [1, 'student-1', 3],
      [2, 'student-2', 3],
      [3, 'student-4', 3]
    ]
  );

  const weekly = await service.getLeaderboard('weekly');
  assert.equal(weekly.windowStart, '2026-03-09T00:00:00.000Z');
  assert.equal(weekly.windowEnd, '2026-03-16T00:00:00.000Z');
  assert.deepEqual(
    weekly.entries.map((entry) => [entry.rank, entry.userId, entry.score]),
    [
      [1, 'student-2', 3],
      [2, 'student-4', 3],
      [3, 'student-1', 1]
    ]
  );

  const monthly = await service.getLeaderboard('monthly');
  assert.equal(monthly.windowStart, '2026-03-01T00:00:00.000Z');
  assert.equal(monthly.windowEnd, '2026-04-01T00:00:00.000Z');
  assert.deepEqual(
    monthly.entries.map((entry) => [entry.rank, entry.userId, entry.score]),
    [
      [1, 'student-1', 3],
      [2, 'student-2', 3],
      [3, 'student-4', 3]
    ]
  );

  const streak = await service.getLeaderboard('streak');
  assert.deepEqual(
    streak.entries.map((entry) => [entry.rank, entry.userId, entry.score, entry.longestStreak]),
    [
      [1, 'student-1', 2, 4],
      [2, 'student-2', 2, 2],
      [3, 'student-4', 2, 2]
    ]
  );

  assert.equal(allTime.entries.some((entry) => entry.userId === 'student-3'), false);
  assert.equal(weekly.entries.some((entry) => entry.userId === 'student-3'), false);
  assert.equal(monthly.entries.some((entry) => entry.userId === 'student-3'), false);
  assert.equal(streak.entries.some((entry) => entry.userId === 'student-3'), false);
});

test('admin overview aggregates platform totals from local platform data', async () => {
  const service = createService();
  const overview = await service.getAdminOverview();

  assert.deepEqual(overview, {
    totalUsers: 5,
    activeUsers: 4,
    activeWindowDays: 30,
    totalSubmissions: 15,
    totalAcceptedSubmissions: 11,
    uniqueProblemSolves: 10
  });
});
