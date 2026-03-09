# admin-api

Minimal FastAPI scaffold for the admin-facing API.

## Run locally

From the repository root:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --clear /tmp/oj-admin-api-venv
source /tmp/oj-admin-api-venv/bin/activate
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python /tmp/oj-admin-api-venv/bin/python -r apps/admin-api/requirements.txt
ADMIN_SESSION_SECRET='local-admin-session-secret' \
ADMIN_WEB_BASE_URL='http://127.0.0.1:5173' \
ADMIN_MICROSOFT_CLIENT_ID='local-microsoft-client' \
ADMIN_MICROSOFT_REDIRECT_URI='http://127.0.0.1:8200/admin/auth/callback/microsoft' \
ADMIN_MICROSOFT_OIDC_MODE='mock' \
ADMIN_MICROSOFT_MOCK_EMAIL='admin@example.com' \
DATABASE_URL='postgresql://oj:oj@127.0.0.1:5432/oj' \
uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

Routes available in this MVP:

```text
GET http://127.0.0.1:8200/healthz
POST http://127.0.0.1:8200/admin/auth/login
GET http://127.0.0.1:8200/admin/auth/login/microsoft
GET http://127.0.0.1:8200/admin/auth/callback/microsoft
GET http://127.0.0.1:8200/admin/auth/me
POST http://127.0.0.1:8200/admin/auth/totp/verify
POST http://127.0.0.1:8200/admin/auth/totp/enroll/init
POST http://127.0.0.1:8200/admin/auth/totp/enroll/confirm
POST http://127.0.0.1:8200/admin/auth/logout
GET http://127.0.0.1:8200/admin/problems
GET http://127.0.0.1:8200/admin/users
GET http://127.0.0.1:8200/admin/users/{userId}
POST http://127.0.0.1:8200/admin/users
PUT http://127.0.0.1:8200/admin/users/{userId}
POST http://127.0.0.1:8200/admin/users/{userId}/enable
POST http://127.0.0.1:8200/admin/users/{userId}/disable
POST http://127.0.0.1:8200/admin/users/{userId}/password
```

## Run tests

```bash
PYTHONPATH=apps/admin-api PYTHONDONTWRITEBYTECODE=1 /tmp/oj-admin-api-venv/bin/python -m pytest -p no:cacheprovider apps/admin-api/tests
```

## Admin auth configuration

Required env vars:

- `ADMIN_SESSION_SECRET`
- `ADMIN_WEB_BASE_URL`
- `ADMIN_MICROSOFT_CLIENT_ID`
- `ADMIN_MICROSOFT_REDIRECT_URI`
- `DATABASE_URL`

Live-provider additions:

- `ADMIN_MICROSOFT_CLIENT_SECRET`
- `ADMIN_MICROSOFT_TENANT_ID`
- `ADMIN_MICROSOFT_OIDC_MODE=live`

Local mock-provider additions:

- `ADMIN_MICROSOFT_OIDC_MODE=mock`
- `ADMIN_MICROSOFT_MOCK_EMAIL`
- `ADMIN_MICROSOFT_MOCK_SUBJECT`
- `ADMIN_TOTP_ISSUER`

## Admin auth behavior

- `POST /admin/auth/login` verifies local admin email/password credentials.
- Microsoft OIDC provides the external identity.
- `admin-api` maps Microsoft identity to the same local platform user model used by local login.
- Local admin admission still requires `role = admin` and `status = active` for both login modes.
- If the resolved admin has TOTP enabled, local login and Microsoft callback both return a `pending_tfa` session instead of a fully authenticated session.
- Only a successful `/admin/auth/totp/verify` call upgrades the session to `authenticated_admin`.

`GET /admin/problems` reads the shared Postgres problem tables directly for the
Admin Web. It returns the latest known title, a `visibility` field, and
`updatedAt`. When a manifest-level visibility row is unavailable, the route
falls back to the latest publication state string for that problem.
