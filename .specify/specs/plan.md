# Technical Plan

## Current Architecture Baseline

The platform currently consists of:

- `apps/vscode-extension` for the student workflow
- `apps/api` for student-facing reads, submissions, and student auth/session boundaries
- `apps/judge-worker` for sandbox execution and result persistence
- `apps/admin-web` for browser-based admin operations
- `apps/admin-api` for admin auth and admin-only APIs
- Postgres as the shared source of truth

## Stable Product Boundaries

- the extension is student-only
- Admin Web and `admin-api` are admin-only
- hidden tests remain server-side
- the worker is the only execution surface for student code
- runtime metrics preserve measured-vs-unavailable semantics

## Active Documentation Themes

### 1. Architecture And Boundary Clarity

- keep one primary architecture document
- keep admin and student boundaries explicit
- keep README focused on orientation and quick start

### 2. Judge Reliability

- preserve the `queued -> running -> finished | failed` lifecycle
- keep verdict production and worker failure modes explicit
- keep runtime metrics trustworthy across persistence and UI rendering

### 3. Authentication Separation

- keep student auth on the student API path
- keep admin auth in Admin Web plus `admin-api`
- document TOTP and local admin authorization as admin-only concerns

### 4. Problem Contract Stability

- keep repository-authored problem folders canonical
- keep public vs hidden tests clearly separated
- keep `entryFunction` aligned across authoring, import, and judging

## Near-Term Documentation Outcomes

- concise core docs under `docs/`
- concise implementation specs under `.specify/specs/`
- no duplicate quick-start or setup guides
- no duplicate problem-format or submission-feedback explanations
