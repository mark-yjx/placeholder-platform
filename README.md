# OJ VSCode Monorepo

Online judge platform with:
- a Node API
- a judge worker
- a VS Code extension
- shared domain, application, contract, config, and infrastructure packages

## Workspace Layout

- `apps/api`: HTTP API runtime
- `apps/judge-worker`: background judge worker
- `apps/vscode-extension`: VS Code extension package
- `packages/domain`: core domain models
- `packages/application`: application services and use cases
- `packages/contracts`: cross-process contracts
- `packages/infrastructure`: Postgres and queue adapters
- `packages/config`: shared config artifacts
- `deploy/local`: local Docker topology, SQL migrations, and seeds
- `docs`: user QA, environment setup, and release runbooks

## What Works

- Real extension-to-API HTTP integration
- Login, fetch problems, submit code, and view results from the extension
- Problems and submissions Explorer views in VS Code
- Local Postgres migration and seed pipeline
- Local smoke flow for API-backed practice scenarios
- CI workflows for checks and release packaging

## Quick Start

Install dependencies:

```bash
npm install
```

Run the main quality gate:

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

## Local Development

Start the supported local stack:

```bash
npm run local:up
npm run local:db:setup
```

Verify the compose-managed runtime:

```bash
docker compose -f deploy/local/docker-compose.yml ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Package the extension:

```bash
npm run extension:package
```

## Important Local Ports

- `5432`: Postgres
- `3100`: real compose-managed API runtime expected by the extension

For normal local use:
- the compose `api` service is the real API runtime
- the compose `worker` service is the only supported judge worker path
- do not start an extra host-side `npm run api:start` or `npm run worker:start` for the same local verification flow

For the extension, set:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100"
}
```

## Useful Commands

```bash
npm run check:boundaries
npm run check:openapi
npm run check:env
npm run local:reset
npm run smoke:local
```

For the supported one-command local demo:
- run `npm run smoke:local`
- this builds and exercises the extension HTTP client path, boots the compose stack, imports sample problems from `data/problems`, verifies the extension `solve()` submit contract, waits for readiness, and verifies a real submission through `queued -> running -> finished|failed`

## Documentation

- [OJ VSCode Demo Checklist](./docs/extension-demo-checklist.md)
- [Environment And Local Setup](./docs/environment-and-local-setup.md)
- [Release Runbook](./docs/release-runbook.md)
- Release troubleshooting checks for login/API/worker issues are included in the release runbook.

## Notes

- The local compose service on port `3000` is not the real API runtime.
- In Remote SSH setups, `localhost` resolves on the remote host where the extension runs.
- The current extension package version is `0.1.0`.
