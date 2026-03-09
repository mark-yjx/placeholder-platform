# Architecture

This repository is a TypeScript monorepo for a local-first Online Judge platform. The VS Code extension is the user-facing client, while the API, Postgres database, judge worker, and importer provide the real backend workflow.

## System Shape

```text
VS Code Extension
        ↓ HTTP
API Server
        ↓
Postgres
        ↓
Judge Worker
        ↓
Sandbox Execution
```

## Components

### Extension

Location: `apps/vscode-extension`

Responsibilities:

- present the VS Code UI workflow
- store the access token in VS Code `SecretStorage`
- fetch problems and problem detail over HTTP
- open or create local coding files under `.oj/problems/`
- submit the current Python file
- poll submission results
- render submissions and submission detail
- keep lightweight workspace-local UI state such as selected problem and local file paths

UI layout:

- Sidebar: problem navigation
- Editor: problem detail plus coding file
- Panel: submissions and submission detail
- Status bar: account entry point

The extension does not judge code locally and does not own submission verdict rules.

### API Server

Location: `apps/api`

Responsibilities:

- expose `/healthz` and `/readyz`
- handle login
- serve published problems and problem detail
- accept student submissions
- validate requests and enforce auth/role checks
- store submissions and judge jobs
- expose submission history and submission detail
- expose admin routes for problem and submission inspection

The API is the only component that accepts student-facing write operations from the extension.

### Domain Layer

Location: `packages/domain`

Responsibilities:

- define problem, submission, verdict, and identity models
- define submission lifecycle states
- encode invariants such as legal state transitions
- define repository ports and policy interfaces

The domain layer is framework-independent. It does not know about VS Code, HTTP, SQL, or Docker.

### Application Layer

Location: `packages/application`

Responsibilities:

- coordinate use cases across domain rules and repository ports
- implement workflows such as login, submission creation, and result queries
- translate domain behavior into application-level services

This is the orchestration layer between domain and infrastructure.

### Persistence Layer

Location: `packages/infrastructure`

Responsibilities:

- implement Postgres-backed repositories
- persist problems, versions, tests, submissions, jobs, and judge results
- provide adapters used by API and worker runtimes

Postgres is the source of truth for imported content, queued work, and judged outcomes.

### Judge Worker

Location: `apps/judge-worker`

Responsibilities:

- claim queued judge jobs
- move submissions from `queued` to `running`
- load the problem version and judge configuration
- execute the configured Python entry function in a sandbox
- persist terminal results and submission status

The worker is the only component that executes student code.

### Problem Importer

Location: `tools/scripts/import-problems.mjs`

Responsibilities:

- read repository-managed problem folders under `problems/`
- validate `manifest.json`
- load `statement.md`, `starter.py`, `public.json`, and `hidden.json`
- compute importable content versions
- persist problem assets and tests into Postgres

The importer bridges source-controlled problem content and runtime storage.

## Submission Lifecycle

The submission flow is:

1. The student selects a problem in the extension.
2. The extension opens or creates `.oj/problems/<problemId>.py`.
3. The student submits from the editor.
4. The extension sends the submission to the API.
5. The API validates auth, ownership rules, published visibility, and language.
6. The API stores the submission in Postgres with status `queued`.
7. The API inserts a judge job into the queue table.
8. The worker claims the job and updates the submission to `running`.
9. The worker loads the imported problem version, entry function, and tests.
10. The worker executes the submission in the sandbox.
11. The worker persists a terminal state of `finished` or `failed`.
12. The extension polls the API and updates the panel views.

## Why The Separation Matters

- The extension can change its UX without changing judge behavior.
- The API can enforce auth and validation consistently.
- Domain rules remain testable without runtime frameworks.
- Postgres-backed persistence survives extension and container restarts.
- The worker stays focused on safe execution and result persistence.
- Problems remain versioned in the repository while still being importable into the runtime database.
