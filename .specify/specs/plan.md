## Technical Plan

### Current Status

Done:
- Phases 1-8 are functionally implemented in the repository.
- Tasks through the currently documented implementation phases are substantially complete through the extension submit/extract/judge wiring path.
- The API runtime uses PostgreSQL-backed adapters for problems, submissions, results, favorites, reviews, and judge jobs.
- The compose `worker` service runs the real judge worker runtime rather than a placeholder keepalive process.
- The worker consumes queued judge jobs, transitions submissions `queued -> running -> finished|failed`, and persists exactly one terminal result per submission.
- Judge result persistence is idempotent for duplicate identical completion events.
- The VS Code extension is a usable shell for login, fetch problems, open starter files, submit code, poll submission status, and display submission state in the tree view.
- The extension uses HTTP clients, not in-memory runtime clients, in normal activation wiring.
- The `solve()`-first judge contract is implemented in the runner harness and covered by unit tests.

Not done:
- Phase 9 is not complete because the local judged submission flow still has a known CE caveat that is not yet closed as a fully proven end-to-end local runtime guarantee.
- The compose API service is still a placeholder health server on `localhost:3000`; the real API runtime under local development remains the host-side process on `localhost:3100`.
- Announcements, full admin oversight UX, release packaging discipline, and deployment hardening are not yet presented as completed end-to-end product workflows.
- The extension is still a functional shell, not a polished end-user experience.

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

### Phase 9: Judge Contract Stabilization

Goals:
- Make the Python judge contract deterministic around `solve()` as the student submission entrypoint.
- Ensure hidden and public tests execute through the same `solve()` contract without leaking hidden test data to clients.
- Ensure duplicate judge completion handling is a no-op for identical terminal results.
- Eliminate CE/WA ambiguity caused by harness/import mismatch for valid Python submissions.

Non-goals:
- No worker architecture rewrite.
- No new language support.
- No changes to ranking, stats, or extension UX beyond what is required to prove judge semantics.

Acceptance checks:
- Submitting a deliberately wrong `solve()` implementation returns `WA`, not `CE`, for a problem with active hidden tests.
- Submitting a correct `solve()` implementation returns `AC`.
- Worker/runtime tests prove extraction keeps `solve()` and only required same-level helpers/imports/constants.
- Hidden tests are not returned by any student-facing API response or extension output.
- Duplicate identical completion handling does not create a second result row and does not throw an immutability error.
- Valid Python syntax with a top-level `solve()` function does not fail due to harness import/name mismatch.

### Phase 10: Extension UX Hardening

Goals:
- Make the VS Code extension reliable for the core student practice loop.
- Keep submission status visible from submit time through terminal verdict.
- Make problem open/edit/submit flow consistent with the local runtime contract.
- Improve user-facing error messages for API unavailable, auth failure, and submission failures.

Non-goals:
- No UI framework rewrite.
- No new feature areas such as announcements, plagiarism checks, or advanced admin dashboards.
- No cross-editor support beyond the current VS Code extension surface.

Acceptance checks:
- After submit, the extension immediately shows `queued`, then `running`, then the terminal verdict in the submissions tree.
- Polling stops once the submission reaches `finished` or `failed`.
- The user can fetch problems, open starter content, edit a Python file, submit, and inspect the final result without manual state refresh.
- Extension tests cover queued/running/finished/failed polling behavior and transient poll retry behavior.
- Extension errors for unreachable API or invalid auth are surfaced with actionable user messages.

### Phase 11: Release/Deployment

Goals:
- Make local compose topology and release docs match the actual runtime model.
- Treat compose and documented startup flows as the source of truth for local verification.
- Define a repeatable release path for the extension package and runtime documentation.
- Keep verification steps explicit enough to serve as a release checklist.

Non-goals:
- No production cloud deployment design.
- No CI/CD platform migration.
- No container orchestration beyond the existing local compose topology.

Acceptance checks:
- Documentation states exactly which services are real compose services versus host-side processes.
- Local verification docs include executable steps for compose boot, DB setup, API boot, submit, judge, and result inspection.
- The compose worker can be started with `docker compose up` and process queue work without a second manual worker process.
- Release docs include a concrete VSIX packaging/checklist path and the expected API base URL configuration for the extension.
- Documentation contradictions between implemented runtime behavior and planning docs are removed.
