# OJ VSCode

OJ VSCode is a local-first Online Judge built around a real VS Code workflow. Students log in from the extension, browse imported problems, open starter files in the workspace, submit Python code to the HTTP API, and receive judged results produced by a Postgres-backed worker and Docker sandbox.

## Project Overview

This repository contains the full local stack:

- a VS Code extension client
- an HTTP API server
- a Postgres persistence layer
- a judge worker
- a Docker-based local environment
- a manifest-driven problem import pipeline

The system is not a fake extension-only simulator. Submissions move through a real backend lifecycle and are judged against imported public and hidden tests.

## Key Features

- Local-first end-to-end workflow with real API, database, and worker services
- VS Code extension for login, problem browsing, coding, submission, and result review
- Problem import pipeline based on source-controlled folders under `problems/`
- Postgres persistence for problems, submissions, queue state, and judge results
- Docker sandbox execution for student Python submissions
- Runtime metrics support with explicit measured vs unavailable semantics
- Hidden-test judging without exposing hidden cases to student-facing surfaces

## UI Layout Overview

Current extension UI architecture:

- Account: status bar icon plus account/login webview window
- Problems: sidebar tree
- Problem Detail: editor/split-view webview
- Submissions: bottom panel tree
- Submission Detail: bottom panel detail webview

Typical student flow:

1. Click the account icon in the status bar.
2. Log in from the account webview.
3. Refresh the `Problems` sidebar.
4. Select a problem to open `Problem Detail`.
5. Open or create `.oj/problems/<problemId>.py`.
6. Submit from the current file or from the problem detail view.
7. Watch the submission transition through `queued -> running -> finished | failed`.
8. Inspect verdict, time, memory, and failure details in the panel.

## Architecture Diagram

```text
                   +----------------------------------+
                   |         VS Code Extension        |
                   |----------------------------------|
                   | Status Bar  | Sidebar  | Panel   |
                   | Account     | Problems | Results |
                   +-------------------+--------------+
                                       |
                                       | HTTP
                                       v
                   +----------------------------------+
                   |            API Server            |
                   |----------------------------------|
                   | Auth | Problems | Submissions    |
                   | Results | Admin | Import APIs    |
                   +-------------------+--------------+
                                       |
                         reads/writes  |  enqueues
                                       v
                   +----------------------------------+
                   |             Postgres             |
                   |----------------------------------|
                   | problems | versions | tests      |
                   | submissions | judge_jobs         |
                   | judge_results | users            |
                   +-------------------+--------------+
                                       ^
                                       | claims jobs / saves results
                                       |
                   +----------------------------------+
                   |           Judge Worker           |
                   |----------------------------------|
                   | load config | build judged code  |
                   | run sandbox | persist verdicts   |
                   +-------------------+--------------+
                                       |
                                       | docker run
                                       v
                   +----------------------------------+
                   |        Docker Sandbox Run        |
                   |----------------------------------|
                   | Python process + cgroup metrics  |
                   +----------------------------------+
```

## Quick Start

Install dependencies:

```bash
npm install
```

Start the local runtime:

```bash
npm run local:up
```

Apply migrations and seed baseline data:

```bash
npm run local:db:setup
```

Import source-controlled problems:

```bash
npm run import:problems -- --dir problems
```

Verify the stack:

```bash
npm run local:ps
docker compose -f deploy/local/docker-compose.yml ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Package the extension:

```bash
npm run extension:package
```

Install the packaged VSIX:

```bash
code --install-extension dist/oj-vscode.vsix
```

## Local Setup

Recommended local settings in VS Code:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

Useful local commands:

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
npm run smoke:local
```

`npm run smoke:local` is the supported one-command local demo. It builds and exercises the extension HTTP client path, imports sample problems from `problems`, verifies the extension `entryFunction` submit contract, and covers the `queued -> running -> finished|failed` flow.

For normal local verification:

- the compose `api` service is the real API runtime on `http://localhost:3100`
- the compose `worker` service is the only supported judge worker path
- do not start an extra host-side `npm run api:start` or `npm run worker:start`

## Extension Usage

- Use the status bar account icon to open the account window and log in.
- Use the `Problems` sidebar refresh action to fetch published problems.
- Select a problem to populate `Problem Detail`.
- Open the starter-backed coding file at `.oj/problems/<problemId>.py`.
- Submit via `Submit`, `OJ: Submit Code`, or `OJ: Submit Current File`.
- Use the `Submissions` panel and `Submission Detail` view to inspect current and previous results.

See [docs/extension-usage.md](./docs/extension-usage.md) for the step-by-step workflow.

## Runtime Metrics Note

Runtime metrics are intentionally not flattened to zero.

- `timeMs` and `memoryKb` may be unavailable
- unavailable metrics must not be stored or displayed as `0`
- the extension renders unavailable memory as `N/A`
- hidden tests never expose hidden inputs or expected outputs in student-facing views

Current local memory measurement attempts to read cgroup peak-memory data from the sandbox container, using the Docker/cgroup v2 path `/sys/fs/cgroup/memory.peak` when available.

See [docs/runtime-metrics.md](./docs/runtime-metrics.md) for details.

## Repository Structure

```text
apps/
  api/                HTTP API runtime
  judge-worker/       queue consumer and sandbox executor
  vscode-extension/   VS Code extension client

packages/
  application/        use-case orchestration
  config/             env/runtime validation inputs
  contracts/          shared contract types
  domain/             business rules and lifecycle models
  infrastructure/     Postgres repositories and adapters

deploy/
  local/              docker-compose stack, SQL migrations, seeds

tools/
  scripts/            local setup, import, smoke, and verification scripts

docs/
  *.md                developer and operator documentation

.specify/
  specs/              tracked implementation phases and tasks

problems/
  <problemId>/        source-controlled problem definitions
```

## Further Reading

- [Architecture](./docs/architecture.md)
- [Judge Pipeline](./docs/judge-pipeline.md)
- [Problem Format](./docs/problem-format.md)
- [Local Development](./docs/local-development.md)
- [Extension Usage](./docs/extension-usage.md)
- [OJ VSCode Demo Checklist](./docs/extension-demo-checklist.md)
- [Release Runbook](./docs/release-runbook.md)
- [Runtime Metrics](./docs/runtime-metrics.md)
- [Roadmap](./docs/roadmap.md)

Release troubleshooting checks live in the release docs above.
