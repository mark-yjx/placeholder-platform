# Environment And Local Setup

This document is the human-readable guide for runtime configuration and local startup.

The source of truth for required runtime variables is:
- `packages/config/env.required.json`

## Required Environment Variables

### API

Required by the current runtime:
- `PORT`
- `DATABASE_URL`

Common local values:

```bash
PORT=3100
DATABASE_URL=postgresql://oj:oj@127.0.0.1:5432/oj
```

Operationally useful in local/dev:
- `JWT_SECRET`

### Judge Worker

Required by the current runtime:
- `DATABASE_URL`
- `DOCKER_IMAGE_PYTHON`

Common local values:

```bash
DATABASE_URL=postgresql://oj:oj@127.0.0.1:5432/oj
DOCKER_IMAGE_PYTHON=python:3.12-alpine
```

Operationally useful in local/dev:
- `DOCKER_HOST`

### Example File

Use [.env.example](/home/mark/src/oj-vscode/.env.example) as the local starting template.

## Local Stack Ports

- `5432`: local Postgres container
- `3100`: real OJ API runtime expected by the extension
- `6379`: not used by the current local stack, but commonly occupied by Redis on developer machines

## Recommended Local Startup

1. Install dependencies:

```bash
npm install
```

2. Start local containers:

```bash
npm run local:up
```

3. Apply schema and seed data:

```bash
npm run local:db:setup
```

4. Verify the real API runtime and compose worker:

```bash
npm run local:ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

The compose `api` service on `3100` is the real local API runtime used by the extension.
The compose `worker` service is the only supported judge worker path for normal local use.
Do not start a second host-side `npm run worker:start`.
If you start a second worker anyway, you are outside the supported local workflow and you must expect competing queue consumers.

## Friendly Port-Conflict Guidance

`npm run local:up` now checks common ports and prints warnings before starting containers.

What the warnings mean:
- `3100` occupied: another web app may block the real local API container
- `5432` occupied: another Postgres instance may block the local DB container
- `6379` occupied: usually Redis; safe to ignore for the current stack, but worth knowing about

If the stack fails to start, inspect the conflicting process and either stop it or change your local setup before retrying.

## One-Command Local Reset

To fully reset the local Docker state for this project:

```bash
npm run local:reset
```

What it does:
- runs `docker compose down -v`
- removes local project volumes, including local Postgres data

Warning:
- this deletes local seeded data and any local DB changes in the project stack

After reset:

```bash
npm run local:up
npm run local:db:setup
```
