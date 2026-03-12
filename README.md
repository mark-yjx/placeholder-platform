# OJ VSCode

OJ VSCode is a local-first Online Judge built around two separate product surfaces:

- `apps/vscode-extension`: the student client inside VS Code
- `apps/admin-web`: the administrator client in the browser

The platform keeps those workflows separate on purpose. Students use the VS Code extension to practice, run public tests locally, submit code, and inspect their own results. Administrators use Admin Web for problem management, tests management, and submission inspection.

## Overview

This repository contains:

- a student-facing VS Code extension
- a student-facing Node/TypeScript API
- an admin-facing React Admin Web
- an admin-facing FastAPI `admin-api`
- a Postgres database shared across the platform
- a judge worker that executes submitted code in Docker
- a repository-driven problem import pipeline

The current platform contract is:

- the VS Code extension is student-only
- Admin Web is admin-only
- `manifest.json` is the canonical problem metadata file
- `manifest.json.publicTests` is the canonical public test source
- `hidden.json` is the canonical hidden test source
- `starter.py` is starter code only and must not contain doctest

## Frontends And APIs

### Student side

- frontend: VS Code extension
- API: Node/TypeScript API

Student responsibilities:

- student login
- fetch published problems
- view problem detail
- open starter files in the workspace
- run manifest public tests locally
- submit solutions
- inspect the student's own submissions

### Admin side

- frontend: Admin Web
- API: FastAPI `admin-api`

Admin responsibilities:

- admin login
- problem management
- public test editing
- hidden test editing
- submission inspection
- admin-only failure detail inspection

Administrators should not use the VS Code extension. The extension is intentionally student-only.

## Architecture

```text
Student side

VS Code Extension
        |
        | HTTP
        v
Node/TypeScript API
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

The student API, admin API, and worker share the same database. The judge worker remains part of the submission path and is not replaced by Admin Web.

## Problem Schema

Canonical repository problem layout:

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

Key rules:

- `manifest.json` contains metadata, `examples`, and `publicTests`
- `statement.md` contains the human-readable statement only
- `starter.py` contains starter code only
- `hidden.json` contains hidden judge-only tests
- doctest is deprecated and is not part of the official problem contract

## Judge Pipeline

Submission lifecycle:

```text
queued -> running -> finished | failed
```

Verdicts for `finished` submissions:

- `AC`
- `WA`
- `CE`
- `RE`
- `TLE`

The worker judges against:

- public tests from `manifest.json.publicTests`
- hidden tests from `hidden.json`

Student-facing wrong-answer feedback may show detailed public-case failure data, but hidden-case failures must remain opaque to students.

## Local Environment

Install dependencies:

```bash
npm install
```

Start the student runtime stack with Docker Compose:

```bash
npm run local:up
```

Apply migrations and seed data:

```bash
npm run local:db:setup
```

Import repository problems:

```bash
npm run import:problems -- --dir problems
```

Package the VS Code extension:

```bash
npm run extension:package
```

Useful quality checks:

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

Current local runtime split:

- Docker Compose runs Postgres, the student API, and the judge worker
- `admin-api` runs separately from `apps/admin-api`
- `admin-web` runs separately from `apps/admin-web`

See [Local Development](./docs/local-development.md) for the full local setup.

## Documentation

- [Architecture](./docs/architecture.md)
- [Judge Pipeline](./docs/judge-pipeline.md)
- [Problem Format](./docs/problem-format.md)
- [Admin Web](./docs/admin-web.md)
- [Extension Usage](./docs/extension-usage.md)
- [Runtime Metrics](./docs/runtime-metrics.md)
- [Local Development](./docs/local-development.md)
- [Roadmap](./docs/roadmap.md)
- [Problem Manifest](./.specify/specs/problem-manifest.md)
- [Submission Feedback](./.specify/specs/submission-feedback.md)
