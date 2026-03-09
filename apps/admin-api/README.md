# admin-api

Minimal FastAPI scaffold for the admin-facing API.

## Run locally

From the repository root:

```bash
python3 -m venv /tmp/oj-admin-api-venv
source /tmp/oj-admin-api-venv/bin/activate
pip install -r apps/admin-api/requirements.txt
uvicorn app.main:app --app-dir apps/admin-api --reload --port 8200
```

The health route is available at:

```text
GET http://127.0.0.1:8200/healthz
```

Expected response:

```json
{ "status": "ok" }
```

## Run tests

```bash
source /tmp/oj-admin-api-venv/bin/activate
PYTHONDONTWRITEBYTECODE=1 pytest -p no:cacheprovider apps/admin-api/tests
```
