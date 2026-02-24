# OJ VSCode Monorepo

## What Has Been Implemented
This repository has been implemented through the full task list in `.specify/specs/tasks.md` (tasks 1-34), including:
- Monorepo/workspace setup, quality gates, boundaries, env/openapi checks.
- Domain modeling (identity, problem versioning, submission lifecycle, judge result, repository ports/services).
- Auth flow + RBAC enforcement.
- Problem CRUD/publication/version history.
- Submission creation, policy checks, admin submission management.
- Judge queue contract, worker sandbox adapter, runner plugin architecture, limit planning.
- Result ingestion (idempotent) and result query APIs.
- Public stats and ranking projection/query routes.
- VSCode-side auth/practice/engagement command modules and tests.
- Local deployment compose stack, DB migration/seed scripts.
- Observability utilities (structured logging with request/job context) and readiness/liveness contracts.

## Current Project State
This is currently a **spec-first implementation scaffold with strong tests and module contracts**.
- Many workspace `build`/`start` scripts are placeholders (they validate flow, not full production runtime behavior).
- The VSCode app contains extension logic modules/tests, but is **not yet packaged as a loadable VS Code extension manifest**.

## Quick Start
### 1. Install
```bash
npm install
```

### 2. Validate project
```bash
npm run typecheck
npm run test
npm run build
```

### 3. Local stack (offline topology)
```bash
npm run local:up
npm run local:ps
npm run local:db:setup
```

Stop stack:
```bash
npm run local:down
```

## Useful Commands
```bash
npm run check:boundaries
npm run check:openapi
npm run check:env
npm run quality
```

## Local DB Pipeline
- Migration SQL: `deploy/local/sql/migrations/001_init.sql`
- Seed SQL: `deploy/local/sql/seeds/001_mvp_seed.sql`
- Commands:
  - `npm run local:db:migrate`
  - `npm run local:db:seed`
  - `npm run local:db:setup`

## Observability Contracts
- API request context supports `x-request-id` and structured log entries include `requestId`.
- Worker structured log entries include `jobId` context.
- Readiness/liveness contracts exist in API and worker modules.

## Known Limitation (Extension Loading)
You cannot directly load `apps/vscode-extension` as a VS Code extension yet because extension manifest/runtime wiring is not scaffolded (`package.json` extension metadata, activation/contributions, debug launch setup).

## Next Practical Step
Scaffold a minimal runnable extension host setup and real API/worker runtime entrypoints if you want interactive usage instead of module-level tests.
