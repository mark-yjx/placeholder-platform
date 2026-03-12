# Local Development

This repository supports local development for both product surfaces:

- student stack: VS Code extension, Node API, Postgres, judge worker
- admin stack: Admin Web and FastAPI `admin-api`

## Prerequisites

- Node.js and npm
- Docker Engine
- Docker Compose plugin
- VS Code
- optional `code` CLI for VSIX installation
- `uv` for the current `admin-api` local workflow

## Install Dependencies

```bash
npm install
```

## Start The Student Runtime

Start the compose-managed local stack for the student runtime:

```bash
npm run local:up
```

Direct equivalent:

```bash
docker compose -f deploy/local/docker-compose.yml up -d --wait
```

This starts:

- Postgres on `127.0.0.1:5432`
- the student API on `http://localhost:3100`
- judge worker in the compose `worker` service

For normal local verification, the compose `api` and `worker` services are the supported student runtime path.

## Database Setup

Apply migrations and seed baseline data:

```bash
npm run local:db:setup
```

Other useful commands:

```bash
npm run local:db:migrate
npm run local:db:seed
```

## Import Problems

Import repository-authored problems:

```bash
npm run import:problems -- --dir problems
```

This imports canonical problem folders from `problems/` into Postgres.

## Run The VS Code Extension

Package the extension:

```bash
npm run extension:package
```

Install it:

```bash
code --install-extension dist/placeholder-extension.vsix
```

Recommended settings:

```json
{
  "oj.apiBaseUrl": "http://127.0.0.1:3100",
  "oj.requestTimeoutMs": 10000
}
```

The extension is student-only. Use it for:

- student login
- fetching problems
- opening starter files
- running public tests locally
- submitting code
- viewing the student's own submissions

## Run admin-api

Run `admin-api` locally from the repository root:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --clear /tmp/oj-admin-api-venv
source /tmp/oj-admin-api-venv/bin/activate
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python /tmp/oj-admin-api-venv/bin/python -r apps/admin-api/requirements.txt
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='correct horse' \
ADMIN_TOKEN_SECRET='local-admin-secret' \
uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

`admin-api` runs separately from Docker Compose today and listens on `http://127.0.0.1:8200`.

## Run Admin Web

From the repository root:

```bash
export VITE_ADMIN_API_BASE_URL='http://127.0.0.1:8200'
npm -w @placeholder/admin run dev
```

By default, Admin Web runs on `http://127.0.0.1:5173`.

Admin Web is the admin-facing client. Use it for:

- admin login
- problem edit flows
- public and hidden tests management
- submission inspection

## Verify Local Services

Check compose services:

```bash
npm run local:ps
```

Check student API health:

```bash
curl http://127.0.0.1:3100/healthz
curl http://127.0.0.1:3100/readyz
```

Check admin API health:

```bash
curl http://127.0.0.1:8200/healthz
```

Recommended quality gate:

```bash
npm run typecheck
npm run test
npm run build
```

## Suggested Full Local Flow

1. `npm install`
2. `npm run local:up`
3. `npm run local:db:setup`
4. `npm run import:problems -- --dir problems`
5. `npm run extension:package`
6. install the VSIX in VS Code
7. run `admin-api` locally
8. start Admin Web with `npm -w @placeholder/admin run dev`
9. configure `oj.apiBaseUrl` in VS Code
10. verify the student flow in the extension
11. verify the admin flow in Admin Web

Typical verification flow:

1. start the compose-managed student stack
2. import repository problems
3. package and install the extension
4. verify the student submission lifecycle `queued -> running -> finished | failed`
5. run `npm run smoke:local`

Operational note: ensure only one worker is active during local verification so submission processing remains deterministic.

## Smoke And Cleanup

Student runtime smoke test:

```bash
npm run smoke:local
```

Stop the compose stack:

```bash
npm run local:down
```

Reset local compose state:

```bash
npm run local:reset
```

## Troubleshooting

- If the extension cannot connect, verify `oj.apiBaseUrl`.
- If submissions stay `queued`, inspect the compose worker logs.
- If the student API is healthy but not ready, inspect Postgres and migration state.
- If Admin Web cannot log in, verify `VITE_ADMIN_API_BASE_URL` and the `admin-api` env vars.
