# Architecture

This repository is a local-first Online Judge monorepo with two explicit product surfaces:

- student side: VS Code extension plus the Node/TypeScript API
- admin side: Admin Web plus the FastAPI `admin-api`

Both sides share the same Postgres database. The judge worker remains the execution engine for submissions and is not replaced by the admin stack.

## System Overview

```text
Student side

VS Code Extension
        |
        | HTTP
        v
Node API
        |
        v
Postgres
        ^
        |
Judge Worker
        |
        | docker run
        v
Sandboxed Python execution


Admin side

Admin Web
        |
        | HTTP
        v
FastAPI admin-api
        |
        v
Postgres
```

## Product Boundary

- The VS Code extension is student-only.
- Administrators must use Admin Web instead of the extension.
- The extension should reject admin-role logins rather than acting as a mixed student/admin client.
- Hidden tests and admin-only inspection data must stay out of student-facing routes and UI.

## Student Side

### VS Code Extension

Location: `apps/vscode-extension`

Responsibilities:

- student login
- fetch published problems
- show problem detail
- open starter files under `.oj/problems/`
- run public tests locally from `manifest.json.publicTests`
- submit Python solutions
- show the student's own submissions and results

The extension is not an admin console. It does not expose hidden tests and does not support admin workflows.

### Node API

Location: `apps/api`

Responsibilities:

- authenticate students
- serve published problem lists and problem detail
- accept student submissions
- persist submissions in `queued` state
- enqueue judge work
- serve student submission history and detail

This API is the student-facing HTTP surface used by the extension.

## Admin Side

### Admin Web

Location: `apps/admin-web`

Responsibilities:

- admin login
- problem management UI
- public test editing
- hidden test editing
- submission inspection
- admin-only operational workflows

Admin Web exists because those workflows have different visibility, access control, and UX requirements from the student extension.

### FastAPI admin-api

Location: `apps/admin-api`

Responsibilities:

- authenticate admins
- serve admin-only problem routes
- serve admin-only tests management routes
- serve admin-only submissions inspection routes

The `admin-api` is a separate operational surface. It does not replace the student Node API.

## Shared Backend

### Postgres

Location: `packages/infrastructure` adapters plus `deploy/local/sql`

Postgres is the shared system of record for:

- imported problems and versions
- public tests
- hidden tests
- submissions
- judge queue rows
- judge results

### Judge Worker

Location: `apps/judge-worker`

Responsibilities:

- claim queued jobs
- transition submissions from `queued` to `running`
- load imported problem assets
- execute student code against public and hidden tests
- persist terminal submission state and verdict data

The worker is shared platform infrastructure. It remains part of the student submission path even though admins can inspect the resulting data.

## Problem Content Flow

Repository-authored problems live under `problems/` using the canonical schema:

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

The importer reads:

- metadata, `examples`, and `publicTests` from `manifest.json`
- statement markdown from `statement.md`
- starter code from `starter.py`
- hidden judge-only tests from `hidden.json`

Doctest is not part of the runtime or authoring contract.

## Submission Flow

1. A student logs in from the extension.
2. The extension fetches published problems from the Node API.
3. The student opens the starter-backed file for a selected problem.
4. The extension can run local public tests from `manifest.json.publicTests`.
5. The student submits code through the Node API.
6. The API stores the submission as `queued` and inserts a judge job.
7. The worker claims the job and moves the submission to `running`.
8. The worker loads the imported problem version, including `entryFunction`, limits, public tests, and hidden tests.
9. The worker executes the judged code in Docker.
10. The worker persists a terminal status of `finished` or `failed`.
11. For `finished` submissions, the worker also persists a verdict such as `AC`, `WA`, `CE`, `RE`, or `TLE`.
12. The Node API serves the result back to the extension.
13. Admin Web can inspect the resulting data through the `admin-api`.

## Architectural Boundaries

- student practice and submission belong to the VS Code extension plus the Node API
- admin operations belong to Admin Web plus the FastAPI `admin-api`
- hidden tests remain admin-only and judge-only
- the worker owns execution
- Postgres owns durable state
- the importer owns the bridge from repository problem files to runtime problem versions
