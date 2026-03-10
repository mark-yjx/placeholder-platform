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

### Phase 12: Runtime Metrics Hardening

Goals:
- Remove misleading runtime metrics from the user experience when the platform did not actually measure them.
- Make it explicit that the current `memory=0KB` behavior is a runtime limitation in the worker/sandbox path, not merely a presentation bug.
- Introduce a trustworthy metrics contract across worker, API, and extension layers.
- Distinguish clearly between measured metrics, unavailable metrics, and legacy placeholder/fallback values.
- Ensure the UI never implies that a metric was measured when it was not.

Why this phase is needed:
- The current local worker path falls back to `memoryKb = 0` when sandbox execution does not provide a measured value.
- That `0` is then persisted and rendered as if it were a real measurement.
- This creates a false signal for users and makes runtime metrics look precise when they are not.
- The problem is architectural: the runtime contract currently allows placeholder values to masquerade as measured values.

Measured vs unavailable vs placeholder:
- Measured metrics are values the sandbox/runtime explicitly collected during real execution.
- Unavailable metrics are values the system could not collect for a particular run or runtime.
- Placeholder or fallback values are synthetic defaults such as `0` used to satisfy a type or rendering path.
- Placeholder values must not be exposed as real execution metrics.

Non-goals:
- No judge lifecycle redesign. Submission states remain `queued -> running -> finished | failed`.
- No change to terminal-state immutability.
- No unrelated submission-pipeline rewrite.
- No breaking change to the end-to-end submission flow while the metrics contract is being hardened.

Acceptance checks:
- The extension renders unavailable metrics as unavailable, not as measured zeroes.
- Worker/runtime code can express whether memory and time were measured or unavailable.
- The API propagates runtime metrics faithfully without hidden zero-filling.
- Documentation explains exactly what runtime metrics mean and when they may be unavailable.

### Phase 13: Admin Identity Hardening

Goals:
- Harden the Admin Web login path with two supported primary login modes: local email/password and Microsoft OpenID Connect.
- Keep the admin authentication model provider-aware without making either local credentials or provider claims the sole source of truth for platform authorization.
- Preserve the existing platform-level user model so admin access remains controlled by local `role` and `status`.
- Make both primary login modes converge into the same local authorization and TOTP-based second-factor flow.
- Keep the student-facing VS Code extension and student-facing Node/TypeScript API unchanged in this phase.

Why Admin Web supports both local credentials and OIDC:
- Local email/password provides a platform-owned admin login path that does not depend on external provider availability or tenant policy.
- Microsoft OIDC provides an SSO path for organizations that want external identity verification and centralized sign-in.
- Supporting both modes keeps the product usable in smaller local deployments and in provider-backed admin environments without changing the downstream authorization model.

Why OIDC is used instead of plain OAuth terminology for the SSO path:
- The requirement is admin login and identity verification, not delegated API access on behalf of a third-party client.
- OIDC defines the identity layer needed here: ID token semantics, issuer validation, nonce handling, discovery metadata, and a standard callback/login model.
- Saying only "OAuth" would be too imprecise because OAuth is the broader authorization framework and does not, by itself, define the full authentication contract the admin stack needs.

Why local user verification and mapping are both required:
- A successful local email/password check proves the user knows the platform credential, but it still does not bypass local authorization rules.
- A successful OIDC login proves the user authenticated with an external identity provider, but it does not by itself decide whether that identity is allowed into this platform.
- The platform must resolve both login modes to the same local platform user so that platform-owned properties such as `role`, `status`, TOTP enrollment, and future recovery/reset controls remain authoritative.
- Local mapping also keeps the design provider-agnostic so Microsoft can be first and Google can be added later without redefining platform authorization rules.

Why admin role enforcement must remain local:
- Admin admission is a platform authorization decision, not a side effect of successful password verification or a trust delegation to Microsoft or any later identity provider.
- The platform must remain able to deny access for `disabled` users, remove admin rights quickly, and keep behavior stable even if external group/tenant claims change unexpectedly.
- Therefore, Admin Web entry must still require a local user with `role = admin` and `status = active` regardless of how the user authenticated first.

Why TOTP is added after primary identity verification:
- The first step is to establish which local platform user the login attempt corresponds to, either by verifying local credentials or by mapping the external OIDC identity.
- Only after that local user resolution succeeds should the platform challenge for a TOTP code, because the TOTP secret belongs to the local platform account rather than to the raw password credential or provider identity.
- This ordering keeps TOTP enrollment, recovery, and enforcement attached to the platform user while allowing both local login and OIDC SSO to share the same second-factor policy.

Why student flows remain unchanged in this phase:
- The hardening work applies only to Admin Web and `admin-api`.
- The student-facing VS Code extension remains student-only and out of scope.
- No student auth redesign, no judge lifecycle change, and no extension admin workflow should be introduced as part of this phase.

Non-goals:
- No redesign of the student-facing auth system.
- No judge worker or submission lifecycle change.
- No course-specific identity assumptions such as roster, zid, lecturer, tutor, or tutorial group mapping.
- No implementation of Google login yet, beyond leaving room for a later provider addition.

Acceptance checks:
- Admin Web is specified to support both local email/password and Microsoft OIDC login modes.
- The planned local login sequence is explicit: `local email/password -> local user verification -> admin role/status check -> TOTP -> admin session`.
- The planned Microsoft login sequence is explicit: `OIDC -> callback -> local user mapping -> admin role/status check -> TOTP -> admin session`.
- Admin entry is specified to require a local user with `role = admin` and `status = active` for both login modes.
- Failure states are explicitly documented for unknown user, disabled user, non-admin user, invalid credentials, and invalid TOTP.
- Architecture and admin docs remain explicit that the VS Code extension is still student-only.

### Phase 14: Student Auth MVP

Goals:
- Replace the extension's editor-embedded login experience with browser-based student sign up and sign in flows.
- Keep student authentication on the existing Node/TypeScript student-facing API rather than moving it into `admin-api`.
- Make the VS Code extension a launcher for student auth rather than the place where credentials are entered.
- Keep student auth and admin auth as separate product surfaces with separate backends and policies.
- Deliver a simple MVP auth return path from the browser back into the extension before any SSO work is introduced.

Why editor-embedded login is being deprecated:
- Entering credentials inside an editor webview is a weak product experience for a platform that already has browser-capable login and registration needs.
- Embedded login makes sign-up, password UX, and future account-recovery flows harder to design and explain.
- It also conflates extension UI responsibilities with account-management responsibilities that belong on the web.

Why browser-based auth is a better student UX:
- A browser page can handle registration, sign-in, validation, and future account flows with clearer navigation and less UI constraint than the extension surface.
- The system browser is also the right place to grow later into password reset, email verification, or third-party auth without rebuilding the extension account panel each time.
- The extension should focus on launching the auth flow and consuming the resulting student session, not on rendering a full account form experience.

Why student auth remains on the existing Node/TypeScript API:
- The student-facing API already owns student login/session concerns and is the backend used by the extension for student actions.
- Keeping student auth there avoids splitting one student workflow across two backends.
- `admin-api` remains an admin-only operational surface and should not become a shared auth service for students in this phase.

Why admin auth and student auth remain separate:
- Students and admins have different products, different UX expectations, and different security surfaces.
- Students use the VS Code extension plus browser-based auth pages backed by the Node/TypeScript API.
- Admins use Admin Web plus `admin-api`.
- Keeping those surfaces separate avoids reintroducing admin behavior into the student client and preserves the student-only product boundary of the extension.

Why SSO/OAuth is deferred:
- The first student auth milestone is to make basic browser-based sign up and sign in work end to end.
- Introducing Google, Microsoft, GitHub, or broader OAuth/SSO too early would add provider complexity before the baseline student account flow is stable.
- Browser-based local registration and login should be the explicit MVP foundation; SSO can build on top later.

MVP student auth fields:
- Sign up: `email`, `displayName`, `password`, `confirmPassword`
- Sign in: `email`, `password`

Non-goals:
- No Google SSO.
- No Microsoft SSO for students.
- No GitHub SSO.
- No passwordless email login.
- No SMS login.
- No student 2FA.
- No major redesign of admin auth.

Acceptance checks:
- Browser-based student auth is specified as the replacement for editor-embedded login.
- The extension is specified to expose student `Sign in` and `Sign up` actions that open the system browser.
- Student registration fields and successful registration behavior are defined.
- Student sign-in fields and successful sign-in behavior are defined.
- One concrete MVP token/session return method from browser to extension is specified and testable.
- Architecture and extension docs state clearly that student auth stays on the Node/TypeScript API and remains separate from admin auth.

### Phase 15: Student Auth Callback UX Upgrade

Goals:
- Upgrade student browser auth so successful sign up and sign in return automatically into the VS Code extension.
- Make automatic VS Code callback the primary student auth completion UX.
- Deprecate manual code copy/paste as the primary completion path while keeping it as a fallback only when callback delivery fails.
- Keep student auth on the existing Node/TypeScript API and keep `admin-api` out of scope.
- Preserve the extension as a student-only client.

Why the callback upgrade is needed:
- Manual code copy/paste is acceptable as an MVP bootstrap, but it breaks the flow and feels unlike a normal app sign-in experience.
- A callback-driven completion path lets the browser hand control back to the extension directly after auth succeeds.
- It reduces friction for both sign up and sign in without moving student auth into the admin stack.

Why the callback should not carry the final session token directly:
- Browser redirects and callback URIs are a poor place to expose long-lived student session tokens.
- A short-lived auth code or session completion token is safer because the backend can enforce one-time use, expiry, and state validation before issuing the real session.
- This keeps the final student session establishment on the API exchange path rather than in the raw browser redirect.

Target callback completion flow:
1. The extension initiates student `Sign in` or `Sign up`.
2. The extension provides a callback URI plus a generated state value.
3. The system browser opens the student auth page on the Node/TypeScript API.
4. The student completes sign up or sign in in the browser.
5. The student-facing API redirects to the callback URI with callback parameters such as state plus a short-lived auth code or completion proof.
6. The extension receives the callback through its URI handler.
7. The extension validates callback state and any local auth-attempt binding.
8. The extension exchanges the short-lived auth code or completion proof with the student-facing API for the real student session/token.
9. The extension stores the authenticated student session and refreshes the signed-in UI automatically.
10. If callback completion fails, the browser may still present manual fallback instructions using a one-time code.

Required extension capabilities:
- register and handle a callback URI
- launch browser auth with callback URI and state
- correlate callback state with the pending auth attempt
- complete the final auth exchange automatically
- show manual fallback instructions only if automatic callback completion fails

Required student-facing API capabilities:
- accept callback URI and state when student sign up or sign in is initiated
- preserve that initiation state through the browser auth flow
- redirect to the callback URI after successful auth
- issue a short-lived auth code or session completion token for the extension exchange step
- complete the final exchange into the real student session/token

Non-goals:
- No student SSO provider work.
- No admin auth redesign.
- No direct browser redirect carrying a long-lived student token when avoidable.
- No judge pipeline change.

Acceptance checks:
- Automatic VS Code callback is specified as the primary student auth completion UX.
- Manual code copy/paste is specified as fallback-only behavior.
- The extension responsibilities for callback URI handling, state validation, and automatic completion are explicit.
- The student-facing API responsibilities for callback initiation, redirect, and final exchange are explicit.
- The security model states that long-lived student tokens should not be returned directly in the callback URI when avoidable.
- Architecture, roadmap, and extension docs all describe the callback upgrade consistently.

### Phase 19: Stats & Ranking MVP

Goals:
- Add a first end-to-end statistics and ranking MVP that feels similar in spirit to LeetCode-style profile stats without introducing contest-rating complexity too early.
- Reuse existing local platform data from users, problems, submissions, and judged results to produce explainable user stats, leaderboards, badges, and a minimal analytics overview.
- Keep formulas deterministic, reproducible, and clearly documented before any implementation-level optimization or materialization work.

MVP scope:
- User stats:
  - solvedCount
  - solvedByDifficulty
  - submissionCount
  - acceptedCount
  - acceptanceRate
  - activeDays
  - currentStreak
  - longestStreak
  - languageBreakdown
  - tagBreakdown
- Leaderboards:
  - all-time leaderboard
  - weekly leaderboard
  - monthly leaderboard
  - streak leaderboard
- Badges:
  - first AC
  - solved 10
  - solved 50
  - 7-day streak
  - 30-day streak
- Surfaces:
  - a student-visible profile/stats surface
  - an admin-visible analytics overview if appropriate for the existing admin product surface

Ranking principles:
- Rankings are derived only from local platform data already owned by this repository.
- Rankings must be reproducible and explainable from documented formulas and tie-break rules.
- Leaderboard formulas stay simple and deterministic for MVP.
- A solved problem counts once per user per problem.
- Accepted-only stats remain clearly distinct from submission-volume stats.

Default MVP leaderboard guidance:
- All-time leaderboard:
  - primary sort: solvedCount descending
  - tie-breakers: acceptedCount descending, submissionCount ascending, stable userId fallback
- Weekly leaderboard:
  - primary sort: unique problems solved in the current UTC week
  - tie-breakers: accepted submissions in the window descending, total submissions in the window ascending, stable userId fallback
- Monthly leaderboard:
  - primary sort: unique problems solved in the current UTC month
  - tie-breakers: accepted submissions in the window descending, total submissions in the window ascending, stable userId fallback
- Streak leaderboard:
  - primary sort: currentStreak descending
  - tie-breakers: longestStreak descending, solvedCount descending, stable userId fallback

Non-goals:
- No complex contest rating algorithm.
- No contest-based Elo-like rating.
- No global percentile system beyond simple deterministic leaderboards.
- No discussion/community reputation model.
- No anti-cheat sophistication beyond basic deterministic counting safeguards.

Acceptance checks:
- The MVP scope for user stats, leaderboards, badges, and profile/analytics surfaces is explicitly documented.
- Ranking principles are documented with simple, reproducible formulas and stable tie-breakers.
- Solved counts are defined as unique solved problems per user rather than raw accepted-submission volume.
- Accepted-only metrics are explicitly distinguished from overall submission-volume metrics.
- The phase explicitly excludes contest-rating complexity, reputation systems, and advanced anti-cheat work.
