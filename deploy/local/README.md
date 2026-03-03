# Local Offline Stack

This stack defines the local container topology for:
- `postgres`
- `api`
- `worker`

## Prerequisites
- Docker Engine + Docker Compose plugin

## Start (single command)
```bash
npm run local:up
```

This maps:
- Postgres: `localhost:5432`
- Placeholder API health: `http://localhost:3000/health`
- Real judge worker: compose `worker` service only
- Real local API runtime: `http://localhost:3100`

## Observability + readiness contracts
- API request-id context uses `x-request-id` (or generated UUID) and structured logs include `requestId`.
- API health routes expose:
  - `liveness` -> `{ status: "ok", requestId }`
  - `readiness` -> `{ status, requestId, dependencies[] }`
- Worker logs include `jobId` on every structured entry.
- Worker readiness exposes dependency status entries as `up/down`.

## Verify health
```bash
npm run local:ps
```

All services should show `healthy`.

## Database migration + seed (fresh setup, no manual SQL)
```bash
npm run local:db:setup
```

This runs:
1. `npm run local:db:migrate` (schema creation)
2. `npm run local:db:seed` (MVP seed data)

For a zero-state run:
```bash
npm run local:down
npm run local:up
npm run local:db:setup
```

## Local smoke (deterministic PASS/FAIL)
```bash
npm run smoke:local
```

The smoke command performs:
1. stack boot
2. seed DB
3. start local API runtime on `localhost:3100`
4. login using fixture token flow
5. admin create problem and attach a real judge config for the smoke version
6. student fetch + favorite + review
7. submit and wait for the compose worker to finish judging
8. assert exactly one persisted judge result row and no remaining queue row for the submission
9. restart the same local API runtime under test
10. fetch again and assert persistence plus the same single-result invariant

Expected terminal end line:
- success: `SMOKE PASS`
- failure: `SMOKE FAIL: <reason>`

## Stop
```bash
npm run local:down
```

## Notes
- This definition is intentionally local-first and self-contained for MVP deployment topology checks.
- The compose `worker` service runs the real judge worker runtime against local Postgres and the host Docker socket.
- The compose `worker` service is the only supported local worker path. Do not start a second host-side `npm run worker:start` for normal local development.
- The compose `api` service on `localhost:3000` is only a placeholder health server; the extension should target the real API runtime on `localhost:3100` unless you explicitly override `oj.apiBaseUrl`.
