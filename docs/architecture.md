# Architecture

This repository implements a local-first online judge as a layered monorepo. The main runtime path is:

1. A student interacts with the VS Code extension.
2. The extension sends HTTP requests to the API server.
3. The API persists problems, submissions, jobs, and results in Postgres.
4. The judge worker claims queued jobs from Postgres.
5. The worker runs tests in a Docker-backed Python sandbox.
6. The worker persists the terminal result.
7. The extension polls the API and renders the result in the sidebar.

## Component Responsibilities

### VS Code Extension

Location: `apps/vscode-extension`

Responsibilities:

- Provide the student-facing UX inside VS Code
- Render the OJ sidebar panels:
  - `Problems`
  - `Problem Detail`
  - `Submissions`
  - `Account`
- Authenticate against `/auth/login`
- Fetch published problems and problem detail over HTTP
- Materialize starter files under `.oj/problems/`
- Submit the active Python file
- Poll submission results and show terminal verdicts

The extension is intentionally thin: it does not judge code locally. It is a client for the real API and worker pipeline.

### API Server

Location: `apps/api`

Responsibilities:

- Expose health endpoints
- Authenticate users and issue access tokens
- Serve published problem summaries and full problem detail
- Accept new submissions
- Persist submission lifecycle state
- Expose result polling endpoints
- Provide admin and engagement endpoints

The API runtime is built on Node's HTTP server and composes application services with Postgres-backed adapters.

### Domain Layer

Location: `packages/domain`

Responsibilities:

- Define core business concepts:
  - problems
  - versions
  - submissions
  - verdicts
  - identities
  - roles
- Enforce policies and invariants:
  - valid submission transitions
  - verdict semantics
  - authorization rules
  - problem validation

The domain layer does not know about HTTP, Docker, Postgres, or VS Code.

### Application Layer

Location: `packages/application`

Responsibilities:

- Compose domain rules into use cases
- Implement orchestration for:
  - login
  - problem publication and querying
  - submission creation
  - result ingestion
  - ranking and stats
- Hide infrastructure details behind repository and service interfaces

This is where the business workflow lives without binding directly to framework code.

### Persistence Layer

Location: `packages/infrastructure`

Responsibilities:

- Implement Postgres repositories for:
  - problems
  - versions
  - tests
  - submissions
  - judge results
  - favorites
  - reviews
- Implement queue storage for judge jobs
- Provide in-memory doubles used by tests where appropriate

Postgres is the source of truth for problem content, queued submissions, and terminal results.

### Judge Worker

Location: `apps/judge-worker`

Responsibilities:

- Claim the next queued judge job
- Load the problem's judge configuration from Postgres
- Transition the submission from `queued` to `running`
- Extract the configured Python `entryFunction`
- Execute public and hidden tests inside a Docker sandbox
- Persist the terminal verdict and metrics
- Mark the submission as `finished` or `failed`

The worker is the only component that runs student code.

### Problem Importer

Location: `tools/scripts/import-problems.mjs`

Responsibilities:

- Read problems from the manifest-based filesystem layout under `problems/`
- Validate `manifest.json`
- Load:
  - `statement.md`
  - `starter.py`
  - `public.json`
  - `hidden.json`
- Compute a stable content digest
- Insert or append problem versions in Postgres
- Persist judge assets and test cases

The importer is the bridge between versioned filesystem content and the runtime problem catalog.

## Submission Lifecycle

The submission path is:

1. User clicks `Submit Current File` in VS Code.
2. The extension sends an authenticated HTTP request to `POST /submissions`.
3. The API validates the request and stores a submission row in Postgres with state `queued`.
4. The API inserts a judge job into the queue table.
5. The worker claims the queued job.
6. The worker updates the submission to `running`.
7. The worker loads the problem's `entryFunction` and test set.
8. The worker executes the submission against public and hidden tests in Docker.
9. The worker persists the terminal verdict and resource usage.
10. The worker marks the submission `finished` or `failed`.
11. The extension polls the API and updates the `Submissions` panel.

## Data Flow Summary

```text
VS Code Extension
  -> /auth/login
  -> /problems
  -> /problems/:problemId
  -> /submissions
  -> /submissions/:submissionId

API Server
  -> Postgres problems tables
  -> Postgres submissions tables
  -> Postgres judge_jobs queue
  -> Postgres judge results tables

Judge Worker
  -> claims judge_jobs
  -> loads problem judge config
  -> runs Docker-backed test execution
  -> persists result + terminal status
```
