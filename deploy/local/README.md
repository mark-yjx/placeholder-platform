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
- API health: `http://localhost:3000/health`

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

## Stop
```bash
npm run local:down
```

## Notes
- This definition is intentionally local-first and self-contained for MVP deployment topology checks.
- API and worker are local runtime containers with health checks to validate orchestration wiring.
