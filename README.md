# OJ VSCode

OJ VSCode is a local-first Online Judge system built around a real VS Code workflow. Students browse problems inside the extension, read the problem detail beside their code, submit from VS Code, and receive real judged results produced by an HTTP API, Postgres, a worker, and sandboxed execution.

## Project Overview

This repository contains the full stack for a local Online Judge:

- a VS Code extension client
- an HTTP API server
- Postgres-backed persistence
- a judge worker
- a manifest-based problem importer
- a Docker-based local runtime

The extension is a client for the platform, not a fake local simulator. Real submissions move through the backend pipeline and are judged against stored public and hidden tests.

## Key Features

- VS Code extension UI for the student workflow
- Problems navigation in the sidebar
- Problem Detail and coding file workflow in the editor area
- Submissions and submission detail in the panel
- Account entry point in the VS Code status bar
- Starter file workflow under `.oj/problems/`
- Submit current file against the real API
- Hidden test execution in the judge pipeline
- Postgres-backed problem, submission, and result storage
- Docker-based local development and smoke testing

## Architecture

```text
VS Code Extension
        ↓ HTTP
API Server
        ↓
Postgres
        ↓
Judge Worker
        ↓
Test Execution
```

High-level repository layout:

- `apps/vscode-extension`: extension UI, commands, HTTP clients, local workspace helpers
- `apps/api`: HTTP runtime, auth, problem and submission routes
- `apps/judge-worker`: queue consumer and sandbox execution runtime
- `packages/domain`: pure business rules and lifecycle models
- `packages/application`: use-case orchestration
- `packages/infrastructure`: Postgres repositories and runtime adapters
- `deploy/local`: Docker Compose runtime and SQL migrations/seeds
- `tools/scripts`: local setup, import, verification, and smoke scripts
- `problems`: manifest-based problem source files
- `.specify`: implementation planning and task/spec material

## Extension UI Layout

The extension is organized around four VS Code surfaces:

- Sidebar: `Problems` navigation
- Editor: `Problem Detail` plus the coding file
- Panel: `Submissions` and `Submission Detail`
- Status Bar: account icon and login entry point

The intended student flow is:

1. click the account icon in the status bar and sign in
2. refresh or fetch problems from the `Problems` view
3. select a problem to open its detail view in the editor area
4. open or create `.oj/problems/<problemId>.py`
5. write code and submit
6. monitor results in the bottom panel

## Quick Start

Install dependencies:

```bash
npm install
```

Start the local stack:

```bash
npm run local:up
```

If you want the direct Docker command:

```bash
docker compose -f deploy/local/docker-compose.yml up -d --wait
```

Initialize the database and seed local baseline data:

```bash
npm run local:db:setup
```

Import repository-managed problems:

```bash
npm run import:problems -- --dir problems
```

Verify the runtime:

```bash
docker compose -f deploy/local/docker-compose.yml ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Package and install the extension:

```bash
npm run extension:package
code --install-extension dist/oj-vscode.vsix
```

Configure VS Code:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

## Local Development

Common commands:

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
npm run local:ps
npm run local:reset
npm run smoke:local
```

Normal local verification should use the compose-managed `api` and `worker` services. For debugging, host-side runtimes also exist:

```bash
npm run api:start
npm run worker:start
```

Use those only when you intentionally want to debug outside the standard Compose path.

## Extension Usage

Once the stack is running and the VSIX is installed:

1. Open a workspace in VS Code.
2. Click the OJ account icon in the status bar.
3. Log in with a local account.
4. Open the `Problems` view and refresh the list.
5. Select a problem to load its detail in the editor area.
6. Use `Open Coding File` to create or open `.oj/problems/<problemId>.py`.
7. Edit the file and use `Submit` or `OJ: Submit Current File`.
8. Inspect submission progress and results in the panel.

## Further Documentation

- [Architecture](./docs/architecture.md)
- [Judge Pipeline](./docs/judge-pipeline.md)
- [Problem Format](./docs/problem-format.md)
- [Local Development](./docs/local-development.md)
