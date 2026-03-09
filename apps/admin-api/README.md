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
source /tmp/oj-admin-api-venv/bin/activate
PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider apps/admin-api/tests
```

Admin auth is configured explicitly through:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN_SECRET`

The API does not persist admin users yet. It validates against the configured
admin credentials and returns a signed bearer token for the Admin Web MVP.
