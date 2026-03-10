# Local Development

## Prerequisites

- Node.js and npm
- Docker Engine with the Compose plugin
- VS Code
- optional `code` CLI for installing the packaged extension
- Python tooling for `admin-api` local development

## Core Student Stack

Install dependencies:

```bash
npm install
```

Start the compose-managed local stack:

```bash
npm run local:up
```

Set up the local database:

```bash
npm run local:db:setup
```

Import repository-authored problems:

```bash
npm run import:problems -- --dir problems
```

The standard local stack includes:

- Postgres
- the student API on `http://localhost:3100`
- the judge worker

## Student Workflow Verification

Package and install the extension:

```bash
npm run extension:package
code --install-extension dist/placeholder-extension.vsix
```

Recommended VS Code settings:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

Typical verification flow:

1. Start the local stack and import problems.
2. Install the packaged extension.
3. Open the account surface and sign in as a student.
4. Refresh the published problem list.
5. Open `.oj/problems/<problemId>.py`.
6. Optionally run public tests locally.
7. Submit and observe `queued -> running -> finished | failed`.

## Admin Stack Development

The admin system is developed separately from the compose-managed student stack.

Create a temporary Python environment for `admin-api`:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --clear /tmp/oj-admin-api-venv
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python /tmp/oj-admin-api-venv/bin/python -r apps/admin-api/requirements.txt
```

Run `admin-api` locally:

```bash
ADMIN_SESSION_SECRET='local-admin-session-secret' \
ADMIN_WEB_BASE_URL='http://127.0.0.1:5173' \
ADMIN_MICROSOFT_CLIENT_ID='local-microsoft-client' \
ADMIN_MICROSOFT_REDIRECT_URI='http://127.0.0.1:8200/admin/auth/callback/microsoft' \
ADMIN_MICROSOFT_OIDC_MODE='mock' \
ADMIN_MICROSOFT_MOCK_EMAIL='admin@example.com' \
DATABASE_URL='postgresql://oj:oj@127.0.0.1:5432/oj' \
/tmp/oj-admin-api-venv/bin/python -m uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

Run the admin frontend:

```bash
VITE_ADMIN_API_BASE_URL='http://127.0.0.1:8200' npm -w @placeholder/admin run dev -- --host 127.0.0.1 --port 5173
```

Run admin tests:

```bash
PYTHONPATH=apps/admin-api PYTHONDONTWRITEBYTECODE=1 /tmp/oj-admin-api-venv/bin/python -m pytest -p no:cacheprovider apps/admin-api/tests
```

## Useful Commands

```bash
npm run typecheck
npm run test
npm run build
npm run smoke:local
npm run local:ps
npm run local:down
npm run local:reset
```

## Local Ports

| Service | URL / Port |
| --- | --- |
| Student API | `http://localhost:3100` |
| Admin API | `http://127.0.0.1:8200` |
| Admin Web | `http://127.0.0.1:5173` |
| Postgres | `127.0.0.1:5432` |

## Troubleshooting

- If the extension cannot reach the API, verify `oj.apiBaseUrl`.
- If submissions remain `queued`, inspect the worker logs and ensure only one worker is active.
- If the API is healthy but not ready, check Postgres availability and migration state.
- If Admin Web cannot log in, verify `VITE_ADMIN_API_BASE_URL` and the local `admin-api` env vars.
