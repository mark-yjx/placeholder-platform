# Online Judge Platform

## Project Overview

This repository contains a local-first Online Judge with separate student and admin
surfaces.

- Students use the VS Code extension to browse problems, open starter files,
  run public tests locally, submit Python code, and inspect results.
- Administrators use Admin Web and `admin-api` for problem management,
  admin-only test data, submission oversight, analytics, and user management.
- The judge worker executes student code in Docker and persists verdicts,
  lifecycle state, and runtime metrics in Postgres.

The repository also includes the problem import pipeline, shared domain and
application packages, and local development scripts for the full stack.

## Architecture Summary

```text
Student workflow:
  apps/vscode-extension -> apps/api -> Postgres -> apps/judge-worker -> Docker

Admin workflow:
  apps/admin-web -> apps/admin-api -> Postgres

Problem authoring:
  problems/* -> tools/scripts/import-problems.mjs -> Postgres
```

Key product boundaries:

- `apps/vscode-extension` is student-only.
- `apps/admin-web` and `apps/admin-api` are admin-only.
- Hidden tests never leave the server-side judge path.
- Runtime metrics keep the distinction between measured values and unavailable values.

## Quick Start

Install dependencies:

```bash
npm install
```

Start the local stack:

```bash
npm run local:up
npm run local:db:setup
npm run import:problems -- --dir problems
```

Package and install the extension:

```bash
npm run extension:package
code --install-extension dist/placeholder-extension.vsix
```

The student API runs on `http://localhost:3100` in the standard local setup.

For the full developer workflow, including Admin Web and `admin-api`, see
[docs/local-development.md](./docs/local-development.md).

## Documentation Map

- [Architecture](./docs/architecture.md)
- [Judge Pipeline](./docs/judge-pipeline.md)
- [Problem Format](./docs/problem-format.md)
- [Admin Web](./docs/admin-web.md)
- [Extension Usage](./docs/extension-usage.md)
- [Runtime Metrics](./docs/runtime-metrics.md)
- [Local Development](./docs/local-development.md)
- [Roadmap](./docs/roadmap.md)

Implementation planning and product-boundary specs live under
[`.specify/specs/`](./.specify/specs/):

- [Technical Plan](./.specify/specs/plan.md)
- [Tasks](./.specify/specs/tasks.md)
- [Problem Manifest](./.specify/specs/problem-manifest.md)
- [Submission Feedback](./.specify/specs/submission-feedback.md)
- [Admin Auth](./.specify/specs/admin-auth.md)
- [Student Auth](./.specify/specs/student-auth.md)
