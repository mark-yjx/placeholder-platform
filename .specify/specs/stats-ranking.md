# Stats & Ranking MVP

## Purpose

This spec defines the first practical statistics and ranking MVP for the current repository stage.

The goal is to add profile-style stats, simple leaderboard views, and rule-based badges using the platform's own local data:

- student-facing VS Code extension
- Node/TypeScript student-facing API
- current problem metadata
- submission and judged-result history
- existing admin surfaces where appropriate

This MVP is inspired by platforms like LeetCode in spirit, but it is intentionally smaller, simpler, and more explainable.

## Product Boundary

Stats and rankings in this phase are derived from platform-owned local data only.

That means:

- no external contest feeds
- no external reputation systems
- no global percentile calculations beyond repository-owned leaderboards
- no cross-platform rating portability

The MVP should fit the platform's current state rather than anticipating a future contest ecosystem.

## MVP Scope

This phase covers four modules:

1. user stats
2. leaderboards
3. badges
4. student/admin stats surfaces

## User Stats

Required user stats for MVP:

- `solvedCount`
- `solvedByDifficulty`
- `submissionCount`
- `acceptedCount`
- `acceptanceRate`
- `activeDays`
- `currentStreak`
- `longestStreak`
- `languageBreakdown`
- `tagBreakdown`

Definitions:

- `solvedCount`
  - the number of unique problems a user has solved
  - a problem counts once per user after at least one accepted (`AC`) submission
- `solvedByDifficulty`
  - the user's unique solved problems grouped by problem difficulty metadata
  - if difficulty metadata is missing, the MVP may group that problem under `unknown`
- `submissionCount`
  - the total number of submissions created by the user
- `acceptedCount`
  - the total number of accepted submissions by the user
- `acceptanceRate`
  - defined as `acceptedCount / submissionCount * 100`
  - if `submissionCount = 0`, acceptance rate is `0`
  - the API returns this value rounded to one decimal place
  - this metric is submission-volume-based, not unique-solve-based
- `activeDays`
  - the number of unique UTC calendar days on which the user made at least one submission
- `currentStreak`
  - the count of consecutive active UTC days ending on today if the user is active today
  - otherwise the count of consecutive active UTC days ending on yesterday
  - if the most recent active day is older than yesterday, `currentStreak = 0`
- `longestStreak`
  - the longest run of consecutive active UTC days in the user's history
- `languageBreakdown`
  - submission counts grouped by submission language
- `tagBreakdown`
  - unique solved problems grouped by problem tags
  - a solved problem contributes at most once per tag per user
  - if a solved problem has no tags, it is grouped under `untagged`

Interpretation rules:

- solved metrics are unique-problem-based
- acceptance metrics are accepted-submission-based
- activity and streak metrics are submission-activity-based
- these categories must not be conflated in the implementation or the UI copy

## Leaderboards

Required leaderboards for MVP:

- all-time leaderboard
- weekly leaderboard
- monthly leaderboard
- streak leaderboard

Window definitions:

- all-time
  - all eligible local platform history
- weekly
  - the current UTC week, starting Monday at `00:00:00` UTC
- monthly
  - the current UTC calendar month, starting on day `1` at `00:00:00` UTC
- streak
  - derived from the current streak metric

Default MVP formulas:

- all-time leaderboard
  - primary sort: `solvedCount` descending
  - tie-breakers:
    - `acceptedCount` descending
    - `submissionCount` ascending
    - stable `userId` fallback
- weekly leaderboard
  - primary sort: unique problems first solved within the weekly window descending
  - tie-breakers:
    - accepted submissions within the weekly window descending
    - total submissions within the weekly window ascending
    - stable `userId` fallback
- monthly leaderboard
  - primary sort: unique problems first solved within the monthly window descending
  - tie-breakers:
    - accepted submissions within the monthly window descending
    - total submissions within the monthly window ascending
    - stable `userId` fallback
- streak leaderboard
  - primary sort: `currentStreak` descending
  - tie-breakers:
    - `longestStreak` descending
    - `solvedCount` descending
    - stable `userId` fallback

Visibility rules:

- rankings are based only on local platform data
- ranking order must be reproducible from documented inputs
- disabled users should not appear unless a later documented product policy explicitly allows it

## Badges

Required badges for MVP:

- `first_ac`
- `solved_10`
- `solved_50`
- `streak_7`
- `streak_30`

Rule definitions:

- `first_ac`
  - awarded when `acceptedCount >= 1`
- `solved_10`
  - awarded when `solvedCount >= 10`
- `solved_50`
  - awarded when `solvedCount >= 50`
- `streak_7`
  - awarded when `longestStreak >= 7`
- `streak_30`
  - awarded when `longestStreak >= 30`

Implementation rule:

- badges may be persisted or derived in MVP
- whichever approach is chosen, badge behavior must be deterministic and consistent
- badge logic should remain rule-based and small in scope

## Student-Facing Surface

MVP requires at least one student-visible stats surface.

Minimum expectations:

- student can view:
  - solvedCount
  - solvedByDifficulty
  - currentStreak
  - longestStreak
  - languageBreakdown
  - badges
  - at least one leaderboard

This surface may live in the extension or another existing student-facing surface, but it must feel like part of the current student workflow rather than a detached analytics prototype.

Implemented MVP placement:

- the student-visible stats surface lives in the signed-in VS Code extension account panel
- the panel shows solved counts, solved-by-difficulty, streaks, language breakdown, badges, and the all-time leaderboard

## Admin Analytics Surface

If appropriate to the existing admin product surface, the MVP should also expose a simple admin-visible analytics overview.

Minimum platform-level aggregates:

- total users
- active users
- total submissions
- total accepted submissions
- total solved events or unique problem solves

The goal is lightweight operational visibility, not a full analytics dashboard.

Implemented MVP definition:

- `activeUsers` means distinct student users with at least one submission in the last 30 days
- `uniqueProblemSolves` means distinct `(user_id, problem_id)` accepted solves

## Ranking Principles

Core MVP principles:

- rankings are derived from local platform data only
- rankings must be reproducible and explainable
- leaderboard score formulas must be simple and documented
- solved problems count once per user per problem
- accepted-only stats are clearly distinguished from submission-volume stats

Implementation guidance:

- prefer deriving metrics from existing data first
- introduce a minimal projection/materialization layer only if the repository fit clearly requires it
- avoid overbuilding ranking infrastructure before usage proves the need

## Out of Scope

This phase does not include:

- complex contest rating algorithms
- contest-based Elo-like rating
- global percentile systems beyond simple local leaderboards
- discussion/community reputation systems
- anti-cheat sophistication beyond basic deterministic safeguards
- judge pipeline redesign
- unrelated auth redesign

## Documentation Requirements

When this phase is implemented, the following must be documented:

- metric definitions
- leaderboard formulas and windows
- badge rules
- any persistence/materialization decision
- student/admin surface placement
- API endpoints:
  - `GET /me/stats`
  - `GET /leaderboards/all-time`
  - `GET /leaderboards/weekly`
  - `GET /leaderboards/monthly`
  - `GET /leaderboards/streak`
  - `GET /admin/analytics/overview`
