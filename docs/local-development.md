# Local Development

This repository is designed to run locally with Docker, Postgres, the real API, the real judge worker, and the VS Code extension.

## Prerequisites

- Node.js and npm
- Docker Engine
- Docker Compose plugin
- VS Code
- optional `code` CLI if you want to install the VSIX from the terminal

## Install Dependencies

```bash
npm install
```

## Start The Local Stack

Preferred command:

```bash
npm run local:up
```

Direct Compose equivalent:

```bash
docker compose -f deploy/local/docker-compose.yml up -d --wait
```

The local stack starts:

- Postgres
- the HTTP API server on `http://localhost:3100`
- the judge worker

For normal local verification, the compose-managed `api` and `worker` services are the supported runtime.

## Database Setup

Apply migrations and seed the local baseline:

```bash
npm run local:db:setup
```

Equivalent split commands:

```bash
npm run local:db:migrate
npm run local:db:seed
```

## Import Problems

Import repository-managed problem content:

```bash
npm run import:problems -- --dir problems
```

This loads the manifest-based folders under `problems/` into Postgres.

## Runtime Verification

Check the compose services:

```bash
docker compose -f deploy/local/docker-compose.yml ps
```

Check the API:

```bash
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Helper command:

```bash
npm run local:ps
```

## API And Worker Development

The normal integration path uses Docker Compose, but host-side entrypoints exist for debugging:

```bash
npm run api:start
npm run worker:start
```

Use them only when you intentionally want a non-compose debugging session. Avoid running a second worker beside the compose-managed worker.

## Admin API Development

Create the local admin-api environment in `/tmp`:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --clear /tmp/oj-admin-api-venv
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python /tmp/oj-admin-api-venv/bin/python -r apps/admin-api/requirements.txt
```

Run the admin API:

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='correct horse' \
ADMIN_TOKEN_SECRET='local-admin-secret' \
DATABASE_URL='postgresql://oj:oj@127.0.0.1:5432/oj' \
/tmp/oj-admin-api-venv/bin/python -m uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

Run the admin-api tests:

```bash
PYTHONPATH=apps/admin-api PYTHONDONTWRITEBYTECODE=1 /tmp/oj-admin-api-venv/bin/python -m pytest -p no:cacheprovider apps/admin-api/tests
```

Admin Web user-management pages are available at:

- `http://127.0.0.1:5173/admin/users`
- `http://127.0.0.1:5173/admin/users/<userId>`

## Extension Development

Package the extension:

```bash
npm run extension:package
```

Install the VSIX:

```bash
code --install-extension dist/oj-vscode.vsix
```

Configure VS Code:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

Current UI architecture:

- Sidebar: problem navigation
- Editor: problem detail and coding file
- Panel: submissions and submission detail
- Status bar: account icon and login entry point

## End-To-End Workflow

1. Start the local stack.
2. Run `npm run local:db:setup`.
3. Run `npm run import:problems -- --dir problems`.
4. Package and install the extension.
5. Open a workspace in VS Code.
6. Click the account icon in the status bar and log in.
7. Open `Problems` and refresh the list.
8. Select a problem to load its detail.
9. Open or create `.oj/problems/<problemId>.py`.
10. Submit from the editor workflow.
11. Inspect results in the panel.

## Testing Workflow

Useful quality commands:

```bash
npm run typecheck
npm run -ws --if-present test
npm run -ws --if-present build
```

Smoke test:

```bash
npm run smoke:local
```

The smoke script validates the real local stack, the login path, problem import, starter-file workflow, submission lifecycle, worker execution, and result recovery.

## Reset And Cleanup

Stop the stack:

```bash
npm run local:down
```

Reset local data:

```bash
npm run local:reset
```

## Troubleshooting

- If the extension cannot connect, verify `oj.apiBaseUrl` is `http://localhost:3100`.
- If submissions remain `queued`, inspect the worker container and worker logs.
- If the API is healthy but not ready, check Postgres availability and migration state.
- If ports such as `3100` or `5432` are busy, the compose stack will not bind correctly.
