# admin-api

Minimal FastAPI scaffold for the admin-facing API.

## Run locally

From the repository root:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --clear /tmp/oj-admin-api-venv
source /tmp/oj-admin-api-venv/bin/activate
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python /tmp/oj-admin-api-venv/bin/python -r apps/admin-api/requirements.txt
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='correct horse' \
ADMIN_TOKEN_SECRET='local-admin-secret' \
uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

Routes available in this MVP:

```text
GET http://127.0.0.1:8200/healthz
POST http://127.0.0.1:8200/admin/auth/login
GET http://127.0.0.1:8200/admin/auth/me
GET http://127.0.0.1:8200/admin/problems
GET http://127.0.0.1:8200/admin/users
GET http://127.0.0.1:8200/admin/users/{userId}
POST http://127.0.0.1:8200/admin/users
PUT http://127.0.0.1:8200/admin/users/{userId}
POST http://127.0.0.1:8200/admin/users/{userId}/enable
POST http://127.0.0.1:8200/admin/users/{userId}/disable
POST http://127.0.0.1:8200/admin/users/{userId}/password
```

Expected login request:

```json
{
  "email": "admin@example.com",
  "password": "correct horse"
}
```

Expected login response:

```json
{
  "token": "<signed token>",
  "user": {
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

## Run tests

```bash
PYTHONPATH=apps/admin-api PYTHONDONTWRITEBYTECODE=1 /tmp/oj-admin-api-venv/bin/python -m pytest -p no:cacheprovider apps/admin-api/tests
```

Admin auth is configured explicitly through:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN_SECRET`

The API preserves the existing env-configured admin login path for compatibility
and also supports managed platform users stored in Postgres. Managed admin users
must have `role = admin` and `status = active`. Managed-user passwords are
stored as hashes, never plaintext.

`GET /admin/problems` reads the shared Postgres problem tables directly for the
Admin Web. It returns the latest known title, a `visibility` field, and
`updatedAt`. When a manifest-level visibility row is unavailable, the route
falls back to the latest publication state string for that problem.
