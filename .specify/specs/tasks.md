1. **Repo Setup: Monorepo workspace bootstrap**  
Goal: Establish npm workspaces for `apps/*` and `packages/*` with TypeScript baseline.  
Files/areas touched: root `package.json`, `pnpm-workspace.yaml` or npm workspaces config, root `tsconfig.base.json`, `apps/`, `packages/`.  
Acceptance checks: `npm run -ws build` resolves workspace packages; directory skeleton matches plan.

2. **Repo Setup: Shared lint/test/build standards**  
Goal: Define consistent scripts and quality gates across all workspaces.  
Files/areas touched: root scripts, `packages/config/*`, workspace `package.json` scripts.  
Acceptance checks: one command runs lint+test+build across all workspaces and exits successfully on a clean repo.

3. **Repo Setup: Clean architecture package boundaries**  
Goal: Enforce dependency direction (`apps -> application/domain/contracts/infrastructure`, `domain -> none`).  
Files/areas touched: workspace dependency manifests, boundary rules (eslint/depcruise config).  
Acceptance checks: boundary rule check fails on forbidden imports and passes on allowed imports.

4. **Repo Setup: Environment and secrets contract**  
Goal: Define env var schema for API, worker, DB, and JWT/runtime settings.  
Files/areas touched: `.env.example`, config schema docs, startup validation module area.  
Acceptance checks: app startup fails with clear message on missing required env vars.

5. **Repo Setup: OpenAPI-first workflow scaffold**  
Goal: Require API contract artifacts before handler implementation.  
Files/areas touched: `contracts/openapi/*`, API contract validation script.  
Acceptance checks: CI check fails if contract validation step is missing or invalid.

6. **Domain: Core identity entities and value objects**  
Goal: Define framework-independent `User`, `Role`, `Permission`, `Email`, `PasswordHash`.  
Files/areas touched: `packages/domain/src/identity/*`.  
Acceptance checks: domain unit tests validate invariants (email format object validity, role assignment constraints).

7. **Domain: Problem model and versioning**  
Goal: Define `Problem`, `ProblemVersion`, publication states, and immutability rules for versions.  
Files/areas touched: `packages/domain/src/problem/*`.  
Acceptance checks: tests prove published versions are immutable and new edits create a new version.

8. **Domain: Submission and lifecycle state machine**  
Goal: Define submission aggregate with constitutional lifecycle `queued -> running -> finished|failed`.  
Files/areas touched: `packages/domain/src/submission/*`.  
Acceptance checks: unit tests reject invalid transitions and accept only legal transitions.

9. **Domain: Judge result model**  
Goal: Define `JudgeResult`, `Verdict`, `ResourceUsage` with strict allowed verdicts.  
Files/areas touched: `packages/domain/src/judge/*`.  
Acceptance checks: tests enforce verdict enum is only `AC/WA/TLE/RE/CE` and metrics are non-negative.

10. **Domain: Repository ports and domain services**  
Goal: Define repository interfaces and policy services (authorization, submission, judge, ranking).  
Files/areas touched: `packages/domain/src/ports/*`, `packages/domain/src/services/*`.  
Acceptance checks: application layer compiles against interfaces only; no domain import from infrastructure.

11. **Auth: Invite/admin-created registration flow**  
Goal: Implement account provisioning path with invite issuance and acceptance.  
Files/areas touched: `application/auth`, `infrastructure/postgres/identity`, API auth/admin routes.  
Acceptance checks: invited user can activate account; non-invited signup is rejected.

12. **Auth: Password credential login stage**  
Goal: Add email+password primary authentication with secure hash verification.  
Files/areas touched: auth use-cases, credential repository adapter, auth API endpoints.  
Acceptance checks: valid credentials issue session/token; invalid credentials return auth failure.

13. **Auth: RBAC authorization enforcement**  
Goal: Enforce `student` vs `admin` permissions at use-case boundary.  
Files/areas touched: authorization policy service, route guards, permission mapping config.  
Acceptance checks: student is denied admin endpoints; admin can access admin endpoints; audit log captures denials.

14. **Problem CRUD: Problem create/update/delete by admin**  
Goal: Provide admin-only create, edit, delete workflows for problems.  
Files/areas touched: problem application services, problem repositories, admin problem API routes.  
Acceptance checks: admin CRUD succeeds; student CRUD attempts return forbidden.

15. **Problem CRUD: Publish/unpublish and student visibility**  
Goal: Only published problems appear in student fetch results.  
Files/areas touched: problem publication service, query handlers, student problem API routes.  
Acceptance checks: unpublished problems are excluded from student list/detail.

16. **Problem CRUD: Problem validation rules**  
Goal: Enforce required metadata and Python language constraint for MVP.  
Files/areas touched: domain validation rules, API request validation contracts.  
Acceptance checks: invalid problem payloads are rejected with deterministic validation errors.

17. **Problem CRUD: Problem version history retrieval**  
Goal: Allow admin to inspect version history for auditability.  
Files/areas touched: problem query handlers, repository queries, admin API contract.  
Acceptance checks: version timeline is returned in chronological order with immutable version identifiers.

18. **Submission: Student submission creation API**  
Goal: Accept Python code submissions for published problems by authenticated students.  
Files/areas touched: submission command handler, submission API route, DB adapter.  
Acceptance checks: submission record created in `queued` state with ownership and problem version snapshot.

19. **Submission: Submission eligibility and limits policy hooks**  
Goal: Enforce submission preconditions (auth, role, published problem, language allowed).  
Files/areas touched: submission policy service, command validation layer.  
Acceptance checks: blocked conditions return clear denial reason; allowed requests enqueue successfully.

20. **Submission: Admin submission management scope**  
Goal: Support admin view, rejudge, delete, export operations.  
Files/areas touched: admin submission ops module, admin API routes, audit logging area.  
Acceptance checks: each admin action works end-to-end and creates audit log entries.

21. **Worker/Sandbox: Queue contract and job dispatch**  
Goal: Define and implement job message contract from API to judge worker.  
Files/areas touched: `packages/contracts/judge/*`, enqueue adapter, worker consumer.  
Acceptance checks: created submission emits exactly one valid judge job payload.

22. **Worker/Sandbox: Docker sandbox execution adapter**  
Goal: Execute untrusted code only inside restricted Docker container with no network.  
Files/areas touched: worker runtime adapter, container policy config, worker integration tests.  
Acceptance checks: integration test confirms network-disabled sandbox and enforced container isolation.

23. **Worker/Sandbox: Resource limits and per-problem overrides**  
Goal: Apply global CPU/memory/time defaults plus per-problem overrides.  
Files/areas touched: judge policy config, worker execution planner, problem config read path.  
Acceptance checks: worker run metadata reflects expected limits for default and overridden problems.

24. **Worker/Sandbox: Python runner plugin interface**  
Goal: Implement runner plugin boundary with Python plugin as first implementation.  
Files/areas touched: worker runner interface, python runner module, language registry.  
Acceptance checks: worker resolves Python via plugin registry; unsupported language is rejected cleanly.

25. **Results: Judge callback and idempotent persistence**  
Goal: Persist verdict/time/memory and transition submission to terminal state once.  
Files/areas touched: result ingestion handler, submission state transition service, result repository.  
Acceptance checks: duplicate judge callbacks do not create duplicate final states or conflicting results.

26. **Results: Student/admin result retrieval API**  
Goal: Expose result details for submission history and admin oversight.  
Files/areas touched: results query handlers, submission detail endpoints.  
Acceptance checks: response always includes verdict, time, memory for finished submissions.

27. **Stats: Public basic statistics projection**  
Goal: Provide MVP basic statistics visible to students.  
Files/areas touched: stats projector, analytics tables/views, student stats API routes.  
Acceptance checks: stats endpoint returns non-empty deterministic aggregates from seeded judged submissions.

28. **Stats: Ranking computation (composite, best submission counts)**  
Goal: Implement approved ranking rule and tie-break policy using best submissions only.  
Files/areas touched: ranking policy service, ranking projector/query, ranking API contract.  
Acceptance checks: ranking order matches predefined fixture scenarios and tie-break tests.

29. **Client MVP: VSCode authentication flow**  
Goal: Deliver extension login UX for email/password authentication and protected session handling.  
Files/areas touched: `apps/vscode-extension` auth views/commands, token handling module.  
Acceptance checks: unauthenticated student cannot reach protected commands; authenticated student can.

30. **Client MVP: Problem browse, submit, and result view**  
Goal: Enable student end-to-end loop in extension: fetch published problems, submit code, poll/view result.  
Files/areas touched: extension problem/submission UI commands, API client layer.  
Acceptance checks: user can complete fetch -> submit -> see AC/WA/TLE/RE/CE + time/memory in extension.

31. **Client MVP: Student engagement and public stats screens**  
Goal: Support favorites, reviews (text + like/dislike), and rankings/stats views in extension.  
Files/areas touched: extension engagement/ranking UI commands, API client contracts.  
Acceptance checks: favorite/review actions persist and stats/ranking views display API data.

32. **Deployment: Local/offline containerized stack definition**  
Goal: Provide local deployment topology for API, worker, Postgres, and required services.  
Files/areas touched: `deploy/local/*`, compose files, local run docs.  
Acceptance checks: single command boots full stack offline and health checks pass.

33. **Deployment: Database migration and seed pipeline**  
Goal: Ensure reproducible schema creation and MVP seed data for local runs.  
Files/areas touched: migration scripts, seed scripts, runbook docs.  
Acceptance checks: fresh database can be migrated and seeded from zero with no manual SQL edits.

34. **Deployment: Observability, request IDs, and readiness checks**  
Goal: Enforce structured logs, request ID propagation, and health/readiness endpoints across API and worker.  
Files/areas touched: logging middleware, worker logging context, health endpoints, ops docs.  
Acceptance checks: logs include request/job IDs; readiness endpoints report dependency status correctly.

35. **VSCode Extension: Minimal runnable manifest**  
Goal: Add proper extension metadata for runtime loading in VS Code.  
Files/areas touched: `apps/vscode-extension/package.json`.  
Acceptance checks: extension can be loaded in Extension Development Host; commands appear in Command Palette.

36. **VSCode Extension: Activation entrypoint**  
Goal: Add activation/deactivation entrypoint and wire command registrations to existing command modules.  
Files/areas touched: `apps/vscode-extension/src/extension.ts`, extension command wiring.  
Acceptance checks: running any command writes to Output Channel and handles errors cleanly.

37. **VSCode Extension: Build pipeline to dist/**  
Goal: Add bundler to emit runnable extension artifact.  
Files/areas touched: extension build config/scripts, `dist/` output mapping, extension `main` path.  
Acceptance checks: `npm run build` produces runnable artifact; extension loads without TS runtime.

38. **VSCode Extension: Debug profile**  
Goal: Add VS Code debug profile and recommended settings for extension development.  
Files/areas touched: `.vscode/launch.json`, `.vscode/extensions.json` (or equivalent recommendations).  
Acceptance checks: `F5` launches Extension Host successfully.

39. **API: Real HTTP runtime entrypoint**  
Goal: Replace placeholder API start with actual HTTP server runtime and health endpoints.  
Files/areas touched: API runtime entrypoint/start scripts, health route wiring.  
Acceptance checks: `npm run api:start` serves `/healthz` and `/readyz`.

40. **Worker: Real runtime entrypoint**  
Goal: Replace placeholder worker start with actual long-running worker runtime loop.  
Files/areas touched: worker runtime entrypoint/start scripts.  
Acceptance checks: `npm run worker:start` starts and idles without crashing.

41. **End-to-end smoke test (local)**  
Goal: Add deterministic local smoke script covering boot, seed, login, submit, and terminal result.  
Files/areas touched: local smoke script(s), runbook/docs, supporting test fixture wiring.  
Acceptance checks: one command produces deterministic PASS/FAIL output.

42. **Docker sandbox "hello world" contract**  
Goal: Add minimal judge job contract execution for known Python snippet in sandbox.  
Files/areas touched: worker sandbox/runner contract test path, fixture judge job input.  
Acceptance checks: worker returns consistent verdict + time + memory.

43. **CI pipeline**  
Goal: Add automated CI checks for core quality gates.  
Files/areas touched: GitHub Actions workflow(s).  
Acceptance checks: PR/push triggers typecheck + test + build (and smoke if enabled) automatically.

44. **VSIX packaging**  
Goal: Add VS Code extension packaging command.  
Files/areas touched: extension packaging scripts/config (`vsce` integration).  
Acceptance checks: `npm run extension:package` outputs `.vsix` and installs locally.

45. **Infrastructure: Postgres schema for problems + engagement**  
Goal: Add Postgres persistence schema for problems and engagement entities used in student practice loop.  
Files/areas touched: SQL migrations/seeds, local DB setup pipeline scripts/docs.  
Acceptance checks: migration includes `problems`, `problem_versions` (immutable), `favorites`, `reviews`; constraints enforce favorites uniqueness per `(user_id, problem_id)`; review rule is explicitly encoded (single review per user/problem or clearly-defined multi-review policy); migration applies cleanly on empty DB; `npm run local:db:setup` succeeds without manual steps; minimal MVP indexes exist for `problem_id` and `user_id` query paths.  
Scope (IN): add/adjust migrations and seeds for the above tables; required constraints and indexes.  
Scope (OUT): no ranking/stats changes; no judge/worker changes; no API route behavior changes except wiring if strictly required.

46. **Infrastructure: Postgres ProblemRepository adapter (read + admin write)**  
Goal: Replace in-memory problem storage with Postgres-backed adapter behind existing repository port.  
Files/areas touched: infrastructure Postgres problem adapter, dependency wiring/composition, adapter tests.  
Acceptance checks: tests prove admin create/update creates new immutable problem version; published versions remain immutable; student fetch returns published versions only; restarting API/container does not lose problems.  
Scope (IN): implement adapter for existing ProblemRepository port and wire via composition root/config.  
Scope (OUT): no extension/UI changes; no new domain model; no judge changes.

47. **Infrastructure: Postgres FavoritesRepository adapter**  
Goal: Persist favorites in Postgres behind existing repository port.  
Files/areas touched: infrastructure Postgres favorites adapter, wiring, adapter tests.  
Acceptance checks: tests prove favorite persists across restart; duplicate favorite is idempotent (single row); unfavorite removes row; favorite list is user-isolated and correct.  
Scope (IN): implement adapter for existing FavoritesRepository port and minimal wiring in local runtime.  
Scope (OUT): no new endpoints/features; no judge/worker changes.

48. **Infrastructure: Postgres ReviewsRepository adapter**  
Goal: Persist reviews in Postgres behind existing repository port with explicit review policy.  
Files/areas touched: infrastructure Postgres reviews adapter, wiring, adapter tests.  
Acceptance checks: tests prove review persists across restart; sentiment + text stored/retrievable; ownership/policy constraints enforced (or rejected when unsupported); if one-review-per-user-per-problem policy is chosen, updates replace previous review with tests; if multi-review policy chosen, ordering/retrieval rules are defined and tested.  
Scope (IN): implement adapter for existing ReviewsRepository port and minimal wiring so review commands use Postgres in local.  
Scope (OUT): no ranking/recommendation changes; no judge/worker changes.

49. **API wiring: switch local runtime from in-memory to Postgres for Problems/Favorites/Reviews**  
Goal: Use Postgres adapters in local runtime without changing business logic.  
Files/areas touched: local config/composition root wiring, adapter selection.  
Acceptance checks: with `npm run local:up`, admin can create problem, student can fetch problems, favorite and review; after container restart, fetching returns same persisted data; no business logic changes beyond adapter selection.  
Scope (IN): configuration and composition wiring only for adapter selection in local runtime.  
Scope (OUT): no schema changes beyond task 45 needs; no judge/worker changes.

50. **Runtime E2E smoke: real Postgres loop for Problems/Favorites/Reviews (no judge)**  
Goal: Add real live-API smoke flow validating persistence across restart for student practice loop.  
Files/areas touched: smoke script(s), local run docs, API test fixtures/tokens as needed.  
Acceptance checks: smoke performs login (or explicit test token fixture), admin create problem, student fetch problems, favorite + review, restart stack (or API container), fetch again and assert persisted state; smoke fails if persistence breaks.  
Scope (IN): implement/adjust smoke script to call live API endpoints (not in-process stubs).  

# Phase 4 – Real Judge Execution

Goal:
Transform the submission pipeline into a fully real execution loop:
Submission → Queue → Worker → Docker Sandbox → Result Persist → Query

## 51. Submission State Machine Hardening

Acceptance checks:
- Submission status defaults to `queued` on creation.
- Valid transitions ONLY:
  queued → running
  running → finished | failed
- Terminal states (`finished`, `failed`) are immutable.
- Restarting the system does not change submission state.
- DB layer enforces transition correctness (constraint or guarded update).

Scope:
IN:
- Domain model
- Repository adapter
- DB-level constraint or guarded update
OUT:
- Worker execution logic
- Queue logic

## 52. Queue Integration (Real Enqueue)

Acceptance checks:
- Creating a submission inserts a job into the queue.
- Submission remains `queued` if worker is offline.
- Submission does NOT auto-transition to `finished`.
- Queue entry references submission id.

Scope:
IN:
- Judge coordination adapter
- Queue adapter implementation
OUT:
- Docker sandbox execution

## 53. Worker State Transition Handling

Acceptance checks:
- Worker consumes job and sets status to `running`.
- On execution completion, worker updates to `finished` or `failed`.
- Worker crash does not incorrectly mark submission as finished.
- State transitions respect constitution terminology exactly.

Scope:
IN:
- Worker process
- Submission repository update logic
OUT:
- Docker execution internals

## 54. Real Docker Python Execution

Acceptance checks:
- Correct Python code results in `finished` with verdict AC.
- Wrong output results in `finished` with verdict WA.
- Runtime exception results in `finished` with verdict RE.
- Execution time and memory are recorded.
- Network access is disabled in sandbox.

Scope:
IN:
- Docker runner adapter
- Python execution environment
OUT:
- Ranking/statistics logic

## 55. Result Persistence Idempotency

Acceptance checks:
- Duplicate result ingestion does not overwrite terminal state.
- Terminal state remains immutable.
- Result API returns persisted verdict/time/memory.

Scope:
IN:
- Result ingestion service
- Repository guarded update
OUT:
- Worker execution

## 56. True End-to-End Smoke

Acceptance checks:
- If worker is stopped, submission remains `queued`.
- Starting worker processes queued submission.
- Result persists across system restart.
- Querying submission returns correct verdict/time/memory.

Scope:
IN:
- Full pipeline integration
OUT:
- UI/Extension enhancements

# Phase 5 – API Stabilization & Error Mapping

Goal:
Stabilize public API contracts and error semantics so the VSCode extension and external clients can rely on consistent behavior.

## 57. Error Normalization

Acceptance checks:
- All API error responses follow a unified JSON structure:
  {
    "error": {
      "code": "<STRING_CODE>",
      "message": "<human_readable_message>"
    }
  }
- No raw stack traces are exposed in production mode.
- 400 validation errors return consistent field-level detail (if applicable).
- Existing success response formats remain unchanged.

Scope:
IN:
- API layer error mapping
- Global error handler/middleware
OUT:
- Domain model changes
- Submission execution logic

## 58. Authentication & Authorization Error Mapping

Acceptance checks:
- Missing/invalid token returns 401.
- Authenticated but insufficient role returns 403.
- No endpoint returns 500 for authentication failures.
- Error codes are deterministic and documented.

Scope:
IN:
- Auth middleware
- Role guard logic
OUT:
- Token generation logic
- User persistence refactor

## 59. Resource Not Found Semantics

Acceptance checks:
- Non-existent problem returns 404.
- Non-existent submission returns 404.
- No 200 responses for missing resources.
- Error structure matches unified error format (Task 57).

Scope:
IN:
- API controllers
- Repository result handling
OUT:
- DB schema changes
- Worker logic

## 60. Health & Readiness Hardening

Acceptance checks:
- /healthz returns 200 if process is alive.
- /readyz returns:
  - 200 only if DB and queue dependencies are reachable.
  - 503 if critical dependency unavailable.
- Readiness check does not mutate system state.
- Response structure is stable and documented.

Scope:
IN:
- Health endpoint implementation
- Dependency checks (DB/queue)
OUT:
- Worker execution changes
- Submission state machine

## 61. Submission Query Stability

Acceptance checks:
- Submission list endpoint returns deterministic ordering (e.g., newest first).
- Fields returned are stable and documented.
- Only `finished` submissions are considered in result-based views (if applicable).
- No breaking changes to existing extension contract.

Scope:
IN:
- API query layer
- Sorting logic
OUT:
- Ranking recalculation logic
- Domain state machine changes

# Phase 6 – VSCode Extension Productionization

Goal:
Stabilize and harden the VSCode extension so it behaves like a usable product
on top of the already-stable API (Phase 5).

The focus is UX stability, configuration safety, and clear error reporting.

## 62. Extension Configuration Stabilization

Acceptance checks:
- `oj.apiBaseUrl` is configurable via VSCode settings.
- Authentication token is stored using VSCode SecretStorage.
- Login state persists across VSCode reload.
- No sensitive data is stored in plain globalState.

Scope:
IN:
- VSCode extension configuration handling
- SecretStorage integration
OUT:
- Backend API changes
- Domain or worker modifications

## 63. User-Facing Error Handling

Acceptance checks:
- API unreachable shows user-friendly error notification.
- 401 triggers clear "Please login" prompt.
- 403 shows permission message.
- 404 resource errors show readable message.
- No raw stack traces shown to end user.

Scope:
IN:
- Extension error handling layer
- Mapping API error structure to UI notifications
OUT:
- API contract changes
- Worker logic

## 64. Problem & Submission UI Stabilization

Acceptance checks:
- Problems TreeView loads real data reliably.
- Submissions list displays verdict, time, memory.
- Selecting a submission shows detailed result.
- UI does not depend on console logs.

Scope:
IN:
- TreeView data providers
- Result rendering logic
OUT:
- API refactor
- Ranking redesign

## 65. Extension Packaging Hardening

Acceptance checks:
- VSIX builds without warnings.
- No unnecessary files included in VSIX.
- Fresh VSCode instance can install and use extension.
- Extension activates correctly on supported events.

Scope:
IN:
- package.json (extension)
- Packaging scripts
- .vscodeignore or files whitelist
OUT:
- Backend changes

# Phase 7 – Real Extension ↔ API Integration

Goal:
Replace in-memory extension clients with real HTTP clients and establish a true end-to-end workflow.

## 66. Implement HTTP API Client in Extension

Title:
Replace InMemory clients with HttpApiClient

Acceptance checks:
- Extension uses real HTTP calls to API base URL
- API base URL is configurable via settings
- All requests use fetch (Node 18+ global fetch)
- Proper error mapping is preserved
- No direct database access from extension

Scope:
IN:
- Implement HttpAuthClient
- Implement HttpPracticeClient
- Implement HttpEngagementClient
- Replace in-memory wiring in extension.ts
OUT:
- UI redesign
- Polling
- Judge pipeline changes

## 67. Wire Login to Real Backend

Acceptance checks:
- OJ: Login calls POST /auth/login
- Token stored in SecretStorage
- Token included in Authorization header
- Invalid credentials mapped to user-friendly error

Scope:
IN:
- Login HTTP integration
- Token persistence
OUT:
- Role-based UI changes

## 68. Fetch Problems from Real API

Acceptance checks:
- OJ: Fetch Problems calls GET /problems
- Problems displayed are DB-backed
- Network failures mapped cleanly
- Empty list handled gracefully

## 69. Submit Code to Real API

Acceptance checks:
- OJ: Submit Code calls POST /submissions
- Submission ID returned from API
- Submission added to Submissions TreeView
- No in-memory submission logic remains

## 70. Poll Submission Result

Acceptance checks:
- OJ: View Result calls GET /submissions/:id
- Properly displays real verdict/time/memory
- Handles running state
- No state mutation in terminal states

## 71. End-to-End Smoke Validation

Acceptance checks:
- Login → Fetch → Submit → Poll → AC flow works
- Data persists across extension reload
- No in-memory fallback logic exists
- Health endpoints accessible from extension

# Phase 8 – Release & Go-Live (User-facing)

Goal:
Make the extension usable by real users with a stable local setup, clear onboarding, and a repeatable release process.

## 72. End-to-end demo checklist + user QA script

Acceptance checks:
- Provide a step-by-step manual QA checklist that a non-developer can follow
- Covers: install VSIX → configure API URL → login → fetch → open problem → submit → see result → favorites/reviews
- Includes expected UI feedback and common failure troubleshooting

Scope:
IN:
- docs only (README/docs)
OUT:
- code changes (unless fixing doc inaccuracies)

## 73. Extension UX polish (minimum viable)

Acceptance checks:
- Problem item click opens a read-only problem detail (markdown doc or virtual document)
- “Submit code” uses active editor Python file when present; otherwise prompts input
- Clear progress indication for queued/running (status bar or notification)
- Errors are actionable (suggest next action)

Scope:
IN:
- extension UI + command behavior only
OUT:
- backend changes unless required by API contract mismatch

## 74. Environment & configuration hardening

Acceptance checks:
- Single documented source of truth for required env vars (API + worker)
- local:up prints the ports and key endpoints
- Detect and explain common port conflicts (3000/5432/6379) in a friendly way
- Provide one command to reset local state (down -v, etc.) with warning

Scope:
IN:
- scripts + docs
OUT:
- feature work

## 75. CI: release-ready workflow

Acceptance checks:
- CI runs: typecheck + unit tests + build
- Optional: smoke E2E can be enabled via workflow input or schedule
- Artifacts: VSIX is produced on release workflow run

Scope:
IN:
- GitHub Actions workflow updates
OUT:
- adding new tests beyond smoke wiring

## 76. Versioning + changelog + packaging hygiene

Acceptance checks:
- Extension has consistent versioning strategy (semver)
- CHANGELOG.md updated
- VSCE packaging includes only intended files
- Repository metadata present (license/repo/homepage where applicable)

Scope:
IN:
- package.json / docs / packaging config
OUT:
- feature work

## 77. Release Runbook

Acceptance checks:
- A documented “how to release” runbook:
  - bump version
  - build
  - package vsix
  - tag/release notes
  - attach artifact
- Includes rollback guidance and “known issues” section

Scope:
IN:
- docs only
OUT:
- code changes

## Phase - Submission from File (Python)

81. **Extension: Submit current editor file**  
Goal: Add a VS Code command that submits the active Python editor contents for the selected problem.  
Files/areas touched: `apps/vscode-extension` commands, Problems view integration, submit API client usage, command unit tests.  
Acceptance checks: Add command `OJ: Submit Current File`; it reads active editor text and requires a `.py` file; it requires that the user has selected a problem in the Problems view (or prompts to pick one); it sends `sourceCode` to the existing submit API client interface using the current file content; unit test rejects non-`.py` and empty editor.

82. **Shared library: Submission extraction**  
Goal: Add a shared extraction module that derives judgeable Python source from a student submission.  
Files/areas touched: `packages/application` or `packages/contracts`, Python source parsing module, extraction unit tests.  
Acceptance checks: Add a package module, preferably in `packages/application` or `packages/contracts`, that parses Python source; if `solve()` exists it chooses `solve`; otherwise it chooses `entryFunction`; it includes same-level helper `def`s with best-effort static analysis; it outputs `extractedSourceCode` as a string; unit tests cover `solve` present, `solve` absent so `entryFunction` is used, helper function included, and malicious extra top-level code excluded on a best-effort basis.

83. **Worker: Wire extraction into judge runner**  
Goal: Execute extracted submission code in the worker instead of the raw source.  
Files/areas touched: worker judge runner, execution pipeline wiring, worker integration tests.  
Acceptance checks: Worker uses `extractedSourceCode` for execution; `__main__` block in starter/submission is not executed; integration test proves a submission with `solve` works and a submission without `solve` but with `entryFunction` works.
Scope (OUT): no judge submission E2E in this phase.
