## Technical Plan

### 1. System Architecture Diagram Description

```text
[VSCode Extension Client]
        |
        v
[API (Node/TypeScript, Clean Architecture)]
  - Auth/RBAC
  - Problem Management
  - Submission API
  - Reviews/Favorites
  - Rankings/Stats
  - Admin Operations
        |
        +------------------------+
        |                        |
        v                        v
 [PostgreSQL]             [Job Queue Port]
 (source of truth)               |
                                 v
                    [Judge Orchestrator Worker]
                                 |
                                 v
                      [Docker Sandbox Runtime]
                                 |
                                 v
                     [Language Runner Plugin]
                       (Python now, extensible)
                                 |
                                 v
                         [Judge Result Store]
                                 |
                                 v
                        [Stats/Ranking Projector]
```

Design intent:
- Modular monolith API + separate judge worker process for isolation.
- Clear ports/adapters boundaries so runtime, queue, auth, and storage can evolve independently.
- Language support added via runner plugins, not core rewrites.

### 2. Module Breakdown

Core modules (inside backend):
- `auth-access`: login, token lifecycle, RBAC authorization policies.
- `user-admin`: invite/admin-created accounts, account status, admin role assignment.
- `problem-catalog`: CRUD problems, publication state, metadata.
- `submission`: create submission, validate eligibility, state transitions.
- `judge-coordination`: enqueue jobs, receive verdict callbacks, enforce idempotency.
- `results`: store AC/WA/TLE/RE/CE + time + memory, expose result views.
- `engagement`: favorites, reviews (text + like/dislike).
- `ranking-stats`: public stats and ranking computation/read models.
- `announcement`: admin announcements.
- `admin-submission-ops`: view/rejudge/delete/export submissions.

Cross-cutting modules:
- `domain`: entities, value objects, domain services, repository interfaces.
- `application`: use-cases, command/query handlers, transaction boundaries.
- `infrastructure`: Postgres repos, queue adapter, docker executor adapter, auth adapter.
- `contracts`: DTOs/events shared between API and worker.

### 3. Domain Layer Design

Entities:
- `User`, `Role`, `Permission`
- `Problem`, `ProblemVersion`, `TestCaseRef`
- `Submission`
- `JudgeJob`, `JudgeResult`
- `Favorite`, `Review`
- `Announcement`
- `RankingEntry`, `StatsSnapshot`

Key value objects:
- `Email`, `PasswordHash`
- `SubmissionId`, `ProblemId`, `UserId`
- `Verdict` (`AC|WA|TLE|RE|CE`)
- `ResourceUsage` (`timeMs`, `memoryKb`)
- `LanguageId` (extensible enum-like registry)

Domain services:
- `AuthorizationPolicyService` (RBAC decisions)
- `SubmissionPolicyService` (who can submit what/when)
- `JudgePolicyService` (limits, retry rules, valid transitions)
- `RankingPolicyService` (composite rule + tie-breaks)
- `ProblemPublicationService`

Repository interfaces:
- `UserRepository`, `ProblemRepository`, `SubmissionRepository`, `JudgeResultRepository`, etc.

### 4. Judge Pipeline Flow

1. Student submits Python code.
2. `submission` use-case stores submission as `queued` and emits `JudgeRequested`.
3. `judge-coordination` writes a job via Queue Port.
4. Worker claims job and transitions submission to `running`.
5. Worker loads problem version/test spec and language config.
6. Worker invokes Docker Runtime Port with resource limits (global defaults + per-problem override).
7. Python runner executes tests in sandbox.
8. Worker collects verdict + time + memory.
9. Worker posts `JudgeCompleted` back to API/application layer.
10. Submission transitions to `finished` or `failed`; result persisted idempotently.
11. `ranking-stats` projector updates public aggregates asynchronously.

Failure handling:
- Retry only for infra/transient failures.
- Deterministic execution failures map to RE/CE/TLE/WA.
- Dead-letter path for repeated infra failure.

### 5. Authentication Model (MVP Scope)

- Account creation: invite/admin-created only.
- Roles: `STUDENT`, `ADMIN` with strict RBAC.

Flow:
1. User submits email + password.
2. If primary credentials are valid, system issues short-lived access token + refresh token.
3. Enforce authorization at use-case boundary using permission matrix (`problem:write`, `submission:rejudge`, etc.).

Phase 2 note:
- Add mandatory TOTP 2FA for student login as a future enhancement.

### 6. Monorepo Structure

```text
/
  apps/
    api/                    # HTTP API, controllers/adapters
    judge-worker/           # job consumer, docker execution orchestration
    vscode-extension/       # client plugin
  packages/
    domain/                 # entities, VOs, domain services, repository ports
    application/            # use-cases, CQRS handlers, policy orchestration
    infrastructure/         # postgres, queue, docker, auth adapters
    contracts/              # shared DTOs/events/schemas
    config/                 # shared tsconfig/eslint/jest/base settings
  tools/
    scripts/                # migration, seed, local ops scripts
  docs/
    architecture/
```

Rules:
- `apps/*` depend on `packages/*`.
- `domain` has zero dependency on framework/DB/runtime.
- Worker and API share contracts, not internal module implementations.

### 7. Data Storage Strategy

Primary strategy:
- PostgreSQL as system of record.
- Transactional writes for core workflows (account/problem/submission/result).
- Read-optimized projections for rankings/stats.

Schema groups:
- `identity`: users, roles, permissions, user_roles, invites, refresh_tokens.
- `problem`: problems, problem_versions, problem_tags, publication_status.
- `submission`: submissions, submission_artifacts, judge_jobs, judge_results.
- `engagement`: favorites, reviews.
- `admin`: announcements, audit_logs.
- `analytics`: ranking_entries, stats_snapshots/materialized aggregates.

Data lifecycle:
- Immutable `problem_versions` and submission source snapshot for auditability.
- Judge results append/update with idempotency key by submission.
- Soft-delete for admin-managed content where recovery/audit matters.
- Retention policy for heavy artifacts (exports/logs) separated from core records.

Performance and integrity:
- Composite indexes on `(problem_id, user_id)`, `(submission_id)`, `(status, created_at)`, ranking sort keys.
- FK constraints for integrity.
- Optimistic locking/version columns for contested admin edits.
- Audit log for admin actions and rejudge/delete/export operations.
