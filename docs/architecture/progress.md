# Project Progress Overview

## 1. Completed Milestones

### Phase 0-1: Repository and architectural foundation
- The monorepo is established with npm workspaces across `apps/*` and `packages/*`, shared TypeScript configuration, and root quality commands for typecheck, build, test, environment validation, boundary checks, and OpenAPI validation.
- Clean Architecture boundaries are defined in the plan and reflected in the repository structure: `domain` for framework-independent models and policies, `application` for use cases, `infrastructure` for adapters, `contracts` for shared DTOs and schemas, and app entrypoints for API, worker, and VS Code extension.
- The constitution-aligned core domain exists for identity, problems, submissions, and judge results, including the required submission lifecycle terminology: `queued -> running -> finished | failed`.
- CI is in place through GitHub Actions with automated install, typecheck, build, test, and optional smoke execution.

### Phase 2: Core product scaffold
- The API/application layers include scaffolding for authentication, RBAC, problem management, submission creation, results retrieval, rankings, and statistics.
- The worker side includes a real runtime loop scaffold, queue contract definitions, Docker sandbox adapter work, language runner plugin boundary, and a hello-world sandbox contract test path.
- The VS Code extension has a runnable extension manifest, activation entrypoint, command registrations, build output under `dist/`, a debug profile, and VSIX packaging workflow.
- Local development support exists through Docker Compose, migration and seed scripts, and workspace-level test coverage across domain, API, worker, and extension modules.

### Phase 3: Persistence and local runtime validation
- PostgreSQL-backed persistence has been added for `problems`, `problem_versions`, `favorites`, and `reviews`, with repository adapters for problems, favorites, and reviews.
- The local API runtime is wired to use the Postgres adapters for problems, favorites, and reviews without moving business logic into infrastructure.
- A live local smoke flow now validates login, admin problem creation, student problem fetch, favorite, review, API runtime restart, and data survival after restart.
- The local stack and Phase 3 workflow establish a concrete persistence loop for the student practice path without changing the judge pipeline.

### Highlights
- Monorepo setup: complete and operating through root workspace scripts.
- Clean Architecture layering: defined and enforced as a core engineering rule.
- CI pipeline: active for install, typecheck, build, test, and optional smoke.
- Local Docker stack: available for Postgres plus local topology checks.
- VSCode extension runtime: packaged as a runnable extension scaffold with activation and build artifacts.
- Postgres persistence for Problems/Favorites/Reviews: implemented and wired into the local API runtime.
- Runtime E2E smoke validation: implemented for the Phase 3 persistence loop and restart survival.

## 2. Verified Real System Loops

### Proven real
- Workspace install, typecheck, build, and test loops are real and exercised through root scripts and CI.
- The local API runtime exposes a real HTTP process for `/healthz` and `/readyz`.
- Problems, favorites, and reviews are persisted through Postgres-backed repositories in the local API runtime.
- The Phase 3 smoke flow uses live API endpoints for login, problem create/fetch, favorite, and review.
- Persistence across API runtime restart is explicitly validated for the problems/favorites/reviews loop.
- The worker runtime loop exists as a real long-running process scaffold, and the Docker sandbox contract path is covered by tests.

### Still scaffolded, stubbed, or not yet proven end-to-end
- The local Docker Compose `api` service now runs the full application runtime on `http://localhost:3100`.
- The local Docker Compose `worker` service now runs the full judge worker runtime.
- Authentication is present as application/runtime scaffolding, but the current local smoke path uses fixture login behavior rather than a full production-grade identity flow.
- The judge pipeline architecture is defined and partially tested, but a fully real submission-to-judge-to-result loop is not yet proven end-to-end in local runtime.
- Rankings and public stats exist as implemented modules and tests, but they are not yet presented in this repository state as a fully proven live production-style loop tied to a real judged submission flow.
- Some build and start scripts remain intentionally lightweight and validate contracts or flow rather than production deployment behavior.

## 3. Engineering Discipline Achieved

- One item = one commit: implementation has progressed task by task, with Phase 3 work recorded as isolated task commits rather than mixed changesets.
- Strict gate validation: the repository standard is explicit and repeatable through `npm install`, `npm run typecheck`, `npm run -ws --if-present build`, and `npm run -ws --if-present test`.
- Acceptance-driven development: task completion is defined by acceptance checks in `tasks.md`, not by implementation volume or commit messages.
- Layer boundary enforcement: the constitution and plan require framework-independent domain models and clear separation between domain, application, infrastructure, contracts, and app entrypoints.
- Constitution-aligned state machines: submission lifecycle terminology follows the constitutional contract exactly as `queued -> running -> finished | failed`.
- API-contract-first and observability-first expectations are embedded into the repository through OpenAPI validation, request/job context logging contracts, and readiness/liveness checks.

## 4. Current System Maturity Assessment

### Architecture
- Maturity: strong.
- The overall shape is coherent: modular monolith API, separate worker, clear ports/adapters split, and extension points for future language support.

### Persistence
- Maturity: moderate to strong for Phase 3 scope.
- Postgres persistence for problems and engagement is implemented and locally validated across restart, which is the most concrete real-system loop currently proven in the repository.

### Judge pipeline
- Maturity: moderate as architecture, lower as production runtime.
- The worker runtime, queue contract, sandbox adapter, runner plugin boundary, and result model are in place, but the repository still needs a real end-to-end judge execution loop wired through live runtime components.

### Observability
- Maturity: moderate.
- Request IDs, job-context logging expectations, and readiness/liveness contracts are present, but the production realism of the local composed services still lags behind the module-level observability design.

### CI/CD
- Maturity: moderate.
- CI reliably runs install, typecheck, build, and test on push and pull request. Smoke support exists but is optional rather than always-on, and deployment automation is not yet the focus.

## 5. Next Phase Roadmap (Proposed Phase 4)

### Goal
- Deliver a real judge execution loop from student submission to sandbox execution to persisted result, using the existing architecture rather than new parallel pathways.

### Key tasks needed
- Replace the placeholder local Docker Compose `api` service with the actual API runtime.
- Replace the placeholder local Docker Compose `worker` service with the actual worker runtime.
- Wire submission creation in live runtime to the judge queue contract.
- Connect the worker runtime to consume real jobs and execute Python code in the Docker sandbox with enforced limits.
- Persist judge results through the defined result ingestion flow and expose them through the existing result APIs.
- Extend local smoke coverage from persistence-only practice flow to submission, execution, and terminal result verification.
- Promote optional smoke toward a reliable CI gate once the judge loop is deterministic enough for automation.

### Acceptance criteria
- A student can submit Python code through the live API runtime.
- The submission enters `queued`, transitions to `running`, and ends in `finished` or `failed` using the constitutional state machine terminology.
- The worker executes the job inside the restricted Docker sandbox with no network and enforced resource limits.
- Exactly one terminal judge result is persisted for a submission, including verdict, time, and memory.
- A deterministic local smoke command proves boot, login, submit, judge, result retrieval, and repeatable PASS/FAIL behavior.

### Risks
- Local determinism may be harder once real Docker sandbox execution and asynchronous worker timing are introduced.
- Compose topology drift can hide issues if local containers continue to run placeholders while host-side processes run the real application code.
- The existing scaffolded start/build scripts may need to become more production-realistic, which can expose dependency and runtime wiring gaps.
- Judge integration increases failure surface across queueing, sandbox isolation, persistence, and observability at the same time, so task slicing must remain disciplined.
