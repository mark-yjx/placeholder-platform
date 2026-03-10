# Architecture

## System Overview

The platform has two user-facing entry points and one shared execution backend:

- `apps/vscode-extension` is the student client.
- `apps/admin-web` is the admin frontend.
- `apps/api` is the student-facing API.
- `apps/admin-api` is the admin-only API.
- `apps/judge-worker` executes student submissions against imported tests.
- Postgres is the shared durable store for problems, submissions, results, and users.

```text
Student path
  VS Code extension
    -> student API
    -> Postgres
    -> judge worker
    -> Docker sandbox

Admin path
  Admin Web
    -> admin-api
    -> Postgres
```

## Application Surfaces

| Component | Path | Audience | Responsibility |
| --- | --- | --- | --- |
| VS Code extension | `apps/vscode-extension` | Students | Problem discovery, local coding workflow, public-test execution, submission, result review |
| Student API | `apps/api` | Students | Published problems, submissions, result polling, student auth/session boundaries |
| Judge worker | `apps/judge-worker` | Internal | Job claiming, sandbox execution, verdict production, runtime metrics capture |
| Admin Web | `apps/admin-web` | Admins | Operational UI for problems, tests, submissions, analytics, and user management |
| Admin API | `apps/admin-api` | Admins | Admin auth, admin-only CRUD and inspection APIs |

## Shared Layers

The apps layer sits on shared packages:

- `packages/domain`: domain entities, verdicts, status rules, and invariants
- `packages/application`: use-case orchestration and application services
- `packages/infrastructure`: Postgres repositories and runtime adapters
- `tools/scripts`: local stack helpers, import tooling, and smoke verification

## Product Boundaries

The platform deliberately separates student and admin behavior:

- The extension is the student surface only. It does not expose hidden tests or admin workflows.
- Admin workflows belong in Admin Web and `admin-api`.
- The student API owns student-facing submission intake and student-facing reads.
- `admin-api` owns admin-only operations and admin authentication.
- The judge worker is the only component that executes student code.
- Postgres is the source of truth for imported problem versions, submissions, jobs, and judge results.

## Submission Lifecycle

The end-to-end student submission flow is:

1. The extension submits Python source to `apps/api`.
2. The API validates the request and stores the submission as `queued`.
3. The API inserts a judge job in Postgres.
4. The worker claims the job and marks the submission `running`.
5. The worker loads the imported problem version, including limits, `entryFunction`,
   examples, public tests, and hidden tests.
6. The worker runs the judged code inside Docker.
7. The worker persists a terminal status of `finished` or `failed`.
8. If the run reached the judge contract, the worker also persists a verdict
   such as `AC`, `WA`, `CE`, `RE`, or `TLE`.
9. The API serves the result back to the extension.

See [judge-pipeline.md](./judge-pipeline.md) for lifecycle and verdict details.

## Problem Content Lifecycle

Problem content is authored in the repository under `problems/<problemId>/` and imported into
runtime storage:

1. A problem folder provides `manifest.json`, `statement.md`, `starter.py`, and `hidden.json`.
2. `tools/scripts/import-problems.mjs` validates the manifest and loads the authored assets.
3. The importer writes the canonical problem version into Postgres.
4. The student API serves only student-visible fields.
5. The worker uses the same imported problem version during judging.

See [problem-format.md](./problem-format.md) for the authored file contract.

## Authentication Boundaries

- Student authentication belongs to the student API and the extension account flow.
- Admin authentication belongs to Admin Web and `admin-api`.
- Hidden tests, admin-only submission inspection, and cross-user operations remain off the student path.
- Admin access requires local admin authorization even when primary authentication uses an external provider.

## Runtime Metrics

The platform tracks runtime metrics as optional measured values:

- `timeMs`
- `memoryKb`

Unavailable metrics remain unavailable through persistence and UI rendering. They are not
rewritten to `0`.

See [runtime-metrics.md](./runtime-metrics.md) for the measurement and propagation rules.
