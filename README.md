# OJ VSCode Monorepo

This project is a local-first Online Judge system integrated with VS Code.

Students solve programming problems directly in VS Code and submit solutions to a real judge pipeline backed by Postgres and a worker. The repository contains the extension, the HTTP API, the judge worker, the shared domain and application layers, the Postgres-backed infrastructure adapters, and the local tooling needed to run everything on a developer machine.

## Key Features

- VS Code extension UI
- Sidebar problem browser
- Starter file workflow
- Submit current file
- Real judge execution
- Hidden test cases
- Postgres-backed persistence
- Docker-based local environment

## System Architecture

The system is organized as a TypeScript monorepo:

- `apps/vscode-extension`: student-facing VS Code extension
- `apps/api`: HTTP API for authentication, problems, submissions, and result polling
- `apps/judge-worker`: background worker that claims queued judge jobs and runs tests
- `packages/domain`: core problem, submission, verdict, identity, and policy models
- `packages/application`: use cases and orchestration services
- `packages/infrastructure`: Postgres repositories and queue adapters
- `packages/contracts`: cross-process data contracts
- `tools/scripts`: local stack orchestration, migrations, seed, import, and smoke automation
- `problems`: manifest-based problem source files used by the importer

ASCII view:

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

In practice, the API and worker both talk to Postgres. The API creates submissions and enqueues judge jobs; the worker claims those jobs, executes the problem tests inside Docker, and writes the terminal result back to the database.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the local stack:

```bash
npm run local:up
npm run local:db:setup
```

Import the sample problems:

```bash
npm run import:problems -- --dir problems
```

Verify the runtime:

```bash
npm run local:ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Package the VS Code extension:

```bash
npm run extension:package
```

Install the extension locally:

```bash
code --install-extension dist/oj-vscode.vsix
```

Configure the extension in VS Code settings:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

Use the extension:

1. Open the OJ sidebar.
2. Login from the `Account` panel.
3. Click `Fetch Problems`.
4. Select a problem in `Problems`.
5. Open or edit the generated starter file in `.oj/problems/<problemId>.py`.
6. Run `OJ: Submit Current File` or use the sidebar action.
7. Poll or view the terminal result from `Submissions`.

## Repository Layout

```text
apps/
  api/
  judge-worker/
  vscode-extension/
packages/
  application/
  config/
  contracts/
  domain/
  infrastructure/
deploy/
  local/
tools/
  scripts/
.specify/
  specs/
problems/
  collapse/
```

## Common Commands

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
npm run local:reset
npm run smoke:local
```

## Additional Documentation

- [Architecture](./docs/architecture.md)
- [Local Development](./docs/local-development.md)
- [Problem Format](./docs/problem-format.md)
- [Judge Pipeline](./docs/judge-pipeline.md)
