# Architecture

This repository is a monorepo for a local-first Online Judge. The student-facing workflow uses a VS Code extension and a Node/TypeScript API. The admin-facing workflow uses a browser-based Admin Web and a FastAPI `admin-api`. Both stacks share the same Postgres database, and the existing judge worker remains part of the student execution path.

## System Overview

```text
Student Side                         Admin Side

VS Code Extension                    Admin Web
       |                                    |
       v                                    v
Node/TypeScript API                  FastAPI admin-api
       |                                    |
       v                                    v
                  Postgres
                      ^
                      |
                 Judge Worker
                      |
                      | docker run
                      v
           Sandboxed Python Execution
```

Boundary policy:

- the VS Code extension is student-only
- administrators must use Admin Web instead of the extension
- the extension should eventually reject admin-role logins at the client boundary

## Extension

Location: `apps/vscode-extension`

Responsibilities:

- authenticate students against the API
- store the access token in VS Code `SecretStorage`
- render the student workflow inside VS Code
- fetch published problems and problem detail
- materialize starter-backed coding files under `.oj/problems/`
- own future local public-test execution when that student-side workflow is implemented
- submit Python source through the API
- poll and render the student's own submission results in panel views

Current UI surfaces:

- status bar account icon
- account webview window
- `Problems` sidebar tree
- `Problem Detail` webview
- `Submissions` panel tree
- `Submission Detail` webview

The extension is a student client, not an admin console and not a judge. It does not execute hidden tests locally.

## Student API Server

Location: `apps/api`

Responsibilities:

- expose health and readiness routes
- handle student login and token-based access
- serve published problem lists and problem detail
- accept student submissions
- persist submissions in `queued` state
- enqueue judge work
- serve student submission history and submission detail

The API is the only write entry point used by the extension for student submissions and student-facing reads.

## Admin Web

Location: `apps/admin-web`

Responsibilities:

- provide a browser-based admin login flow
- render admin operational pages separately from the student extension
- consume the FastAPI `admin-api`
- keep admin-only data such as hidden tests out of student-facing UI surfaces
- own admin workflows that no longer belong in the VS Code extension

Admin Web exists because problem editing, admin-only tests management, cross-user submission inspection, and future operator controls are different workflows from student practice.

## Admin API

Location: `apps/admin-api`

Responsibilities:

- authenticate admin sessions for Admin Web
- serve admin-only problem management routes
- serve admin-only tests management and submission inspection routes
- expand later toward user management and 2FA-related admin controls

The admin API is a separate operational surface. It does not replace the student-facing Node/TypeScript API.

## Domain Layer

Location: `packages/domain`

Responsibilities:

- define submission lifecycle rules
- define verdict and judge-related domain types
- define identity, ranking, and policy primitives
- protect invariants such as terminal-state immutability

The domain layer is framework-agnostic. It does not depend on HTTP, VS Code, SQL, or Docker.

## Application Layer

Location: `packages/application`

Responsibilities:

- coordinate use cases across domain and infrastructure ports
- implement submission creation and result-query workflows
- orchestrate authentication and other application services
- translate persisted data into API-facing or extension-facing views

This is the workflow layer between pure domain logic and runtime adapters.

## Persistence Layer

Location: `packages/infrastructure`

Responsibilities:

- implement Postgres-backed repositories
- persist users, submissions, judge jobs, judge results, and imported problems
- enforce persistence-side contracts such as immutable terminal results
- map nullable runtime metrics to optional application fields

Postgres is the system of record for imported problems and judged outcomes.

## Judge Worker

Location: `apps/judge-worker`

Responsibilities:

- claim queued judge jobs from Postgres
- transition submissions from `queued` to `running`
- load problem version assets and tests
- build runnable judged Python code using the configured `entryFunction`
- run the code in a Docker sandbox
- persist terminal result data and final submission state

The worker is the only component that executes student code.

The worker remains shared between the student-facing and admin-facing stacks.

## Problem Importer

Primary entrypoint: `tools/scripts/import-problems.mjs`

Responsibilities:

- read source-controlled problem folders from `problems/`
- validate `manifest.json`
- load `statement.md`, `starter.py`, and `hidden.json`, with public tests embedded in `manifest.json`
- compute a stable content digest
- insert or append Postgres problem versions and associated assets/tests

The importer converts repository content into runtime data used by the API and worker.

## Submission Flow End To End

1. The student logs in from the extension account window.
2. The extension fetches published problems from the API.
3. The student selects a problem and opens `.oj/problems/<problemId>.py`.
4. The extension submits source code to the API.
5. The API validates the request and persists the submission as `queued`.
6. The API inserts a corresponding row into `judge_jobs`.
7. The extension starts polling submission result endpoints.
8. The worker claims the job and transitions the submission to `running`.
9. The worker loads the imported problem version, including `entryFunction`, limits, and public/hidden tests.
10. The worker wraps the student submission into judged Python code.
11. The worker executes the judged code inside a Docker sandbox.
12. The worker persists a terminal submission state of `finished` or `failed`.
13. If the submission is `finished`, the worker also persists a verdict such as `AC`, `WA`, `CE`, `RE`, or `TLE`.
14. The API serves the result view back to the extension.
15. The extension updates `Submissions` and `Submission Detail`.

## Architectural Boundaries

- The VS Code extension owns student workflow and presentation only.
- Administrators must use Admin Web instead of the extension.
- The extension should eventually reject admin-role logins so the client boundary matches the product boundary.
- Admin Web owns admin workflow and presentation.
- The student-facing Node/TypeScript API owns student authentication, validation, published-problem access, and durable submission intake.
- The FastAPI `admin-api` owns admin-only operational routes, including hidden test access and cross-user inspection.
- The worker owns execution and verdict production.
- Postgres owns durable state.
- The importer owns the bridge from repository-authored problem files to runtime problem versions.

That separation matters because student UX, admin UX, judge behavior, storage, and content authoring can evolve independently without redesigning the whole pipeline.
