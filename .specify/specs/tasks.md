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
