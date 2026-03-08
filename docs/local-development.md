# Local Development

This repository is designed to run locally with Docker, Postgres, a real API process, and a real judge worker.

## Prerequisites

- Node.js and npm
- Docker Engine
- Docker Compose plugin
- VS Code
- `code` CLI if you want to install the VSIX from the terminal

## Install Dependencies

```bash
npm install
```

## Run the Stack with Docker

Preferred command:

```bash
npm run local:up
```

Equivalent Docker command:

```bash
docker compose -f deploy/local/docker-compose.yml up -d --wait
```

This starts:

- `postgres` on `localhost:5432`
- `api` on `http://localhost:3100`
- `worker` as the background judge consumer

## Initialize Database State

Apply migrations and seed data:

```bash
npm run local:db:setup
```

Import problems from the repository:

```bash
npm run import:problems -- --dir problems
```

## Verify Local Health

```bash
npm run local:ps
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Expected responses:

- `healthz`: `{"status":"ok"}`
- `readyz`: `{"status":"ready", ...}`

## Running API and Worker

For normal development, use the compose-managed services above.

Direct host commands exist mainly for debugging:

```bash
npm run api:start
npm run worker:start
```

Normal local workflow guidance:

- Prefer the compose `api` service for the real extension integration path
- Prefer the compose `worker` service as the only active judge worker
- Do not run an extra host-side worker against the same queue unless you are intentionally debugging concurrent consumers

## Install the VS Code Extension

Package the extension:

```bash
npm run extension:package
```

Install the generated VSIX:

```bash
code --install-extension dist/oj-vscode.vsix
```

## Configure the Extension

Open VS Code settings JSON and set:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

## End-to-End Developer Flow

1. Start the local stack.
2. Seed the database.
3. Import the problems.
4. Install the VSIX.
5. Open the OJ sidebar in VS Code.
6. Login from the `Account` panel.
7. Fetch problems.
8. Select a problem.
9. Edit the generated file under `.oj/problems/`.
10. Submit the current file.
11. Watch the submission progress from `queued` to `running` to `finished` or `failed`.

## Smoke Test

Run the supported end-to-end smoke test:

```bash
npm run smoke:local
```

The smoke flow boots the stack, verifies readiness, exercises the extension HTTP client path, submits a real solution, and confirms that the worker produces a terminal result.

## Useful Reset Commands

Stop containers and remove local volumes:

```bash
npm run local:down
```

Full reset:

```bash
npm run local:reset
```

## Troubleshooting

- If `3100` is busy, the local API container cannot bind successfully.
- If `5432` is busy, the Postgres container cannot start.
- If login or polling fails, verify `oj.apiBaseUrl` points to `http://localhost:3100`.
- If submissions stay `queued`, check the worker container health and logs.
