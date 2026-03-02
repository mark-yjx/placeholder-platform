# OJ VSCode Demo Checklist

This guide is for manual QA of the packaged VS Code extension by a non-developer.

## Before You Start

You need:
- VS Code
- the packaged extension file: `apps/vscode-extension/oj-vscode-extension-0.1.0.vsix`
- a running OJ API reachable from VS Code

For the local stack used in this repository:
- Docker must be running
- Postgres stack must be up
- the real OJ API should run on `http://localhost:3100`

Repository operator setup:

```bash
npm install
npm run local:up
npm run local:db:setup
DATABASE_URL=postgresql://oj:oj@127.0.0.1:5432/oj PORT=3100 npm run api:start
```

Health check:

```bash
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Expected:

```json
{"status":"ok"}
{"status":"ready"}
```

## 1. Install The VSIX

1. Open VS Code.
2. Open Extensions.
3. Open the `...` menu.
4. Choose `Install from VSIX...`.
5. Select `oj-vscode-extension-0.1.0.vsix`.

Expected:
- the extension `OJ VSCode` appears as installed
- after reload, the `OJ VSCode` output channel is available

If you use Remote SSH:
- install the VSIX into the remote extension host, not only on your local machine

## 2. Configure The API URL

1. Open Command Palette.
2. Run `Preferences: Open Settings (JSON)`.
3. Add:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100"
}
```

Expected:
- after `Developer: Reload Window`, the output channel shows:

```text
OJ VSCode extension activated
API base URL: http://localhost:3100
API health: ok
API readiness: ready
```

## 3. Login

1. Open Command Palette.
2. Run `OJ: Login`.

Expected UI:
- notification: `[oj.login] success`

Expected output:

```text
[oj.login] start
Authenticated
[oj.login] success
```

Notes:
- the current demo build uses the seeded fixture student login
- login state should persist across reload through SecretStorage

## 4. Fetch Problems

1. Run `OJ: Fetch Problems`.

Expected UI:
- if problems exist: `Loaded <n> problems.`
- if no problems exist: `No published problems available.`

Expected output:

```text
[oj.practice.fetchProblems] start
Problems loaded: <n>
[oj.practice.fetchProblems] success
```

Expected Explorer views:
- `OJ Problems`
- `OJ Submissions`

Expected data:
- `OJ Problems` shows published problems from the database

If the view is not visible:
1. Open Explorer.
2. Open the `...` menu.
3. Open `Views`.
4. Enable `OJ Problems` and `OJ Submissions`.

## 5. Open A Problem

Current packaged behavior:
- problem items are visible in the `OJ Problems` tree
- clicking a problem does not yet open a separate detail document in this build

Pass criteria for the current demo:
- the problem list is visible
- each problem shows its title and id

Known limitation:
- read-only problem detail view is planned for Task 73

## 6. Submit Code

1. Run `OJ: Submit Code`.

Expected UI:
- notification: `[oj.practice.submitCode] success`

Expected output:

```text
[oj.practice.submitCode] start
Submitted: <submission-id>
[oj.practice.submitCode] success
```

Expected Explorer behavior:
- a new item appears in `OJ Submissions` immediately
- initial status is a submitted or waiting state

Current packaged behavior:
- the command submits a built-in Python snippet for the first visible problem

## 7. See The Result

1. Run `OJ: View Result`.

Expected:
- if judging is still in progress, the extension shows a queued or running state
- if judging is complete, the extension shows verdict, time, and memory

Expected output examples:

```text
Submission <submission-id>: status=running
```

or

```text
Submission <submission-id>: verdict=AC, time=120ms, memory=2048KB
```

Expected Explorer behavior:
- the same submission row updates to the latest result
- once the result is terminal, it should stay terminal

## 8. Favorites

1. Run `OJ: Favorite Problem`.

Expected UI:
- notification: `[oj.engagement.favoriteProblem] success`

Expected output:

```text
[oj.engagement.favoriteProblem] start
Favorites: problem-1
[oj.engagement.favoriteProblem] success
```

Current packaged behavior:
- the command favorites the seeded fixture problem `problem-1`

## 9. Reviews

1. Run `OJ: Submit Review`.

Expected UI:
- notification: `[oj.engagement.submitReview] success`

Expected output:

```text
[oj.engagement.submitReview] start
Reviews for problem-1: <n>
[oj.engagement.submitReview] success
```

Current packaged behavior:
- the command submits a fixture review for `problem-1`

## 10. Reload Persistence Check

1. Run `Developer: Reload Window`.

Expected output:

```text
OJ VSCode extension activated
API base URL: http://localhost:3100
API health: ok
API readiness: ready
Session restored from SecretStorage
Restored <n> problems and <m> submissions from API
```

Expected:
- login remains active
- problems are restored
- submissions are restored

## Common Failures And Fixes

### `API base URL: http://localhost:3000`

Cause:
- old setting or old VSIX build

Fix:
- set `"oj.apiBaseUrl": "http://localhost:3100"`
- reload window
- if needed, reinstall the VSIX

### `API health probe failed: Unexpected token 'o', "not found" is not valid JSON`

Cause:
- port `3000` is pointing at the placeholder compose service, not the real API

Fix:
- use `http://localhost:3100`
- verify `curl http://localhost:3100/healthz`

### `API health probe failed: fetch failed`

Cause:
- nothing is listening on `3100`

Fix:
- start the API:

```bash
DATABASE_URL=postgresql://oj:oj@127.0.0.1:5432/oj PORT=3100 npm run api:start
```

### `Practice state restore failed: Not Found`

Cause:
- the API is running, but not with the database-backed local runtime

Fix:
- ensure the DB stack is up
- ensure the API is started with `DATABASE_URL`

### `OJ Problems` is missing even after fetch succeeds

Cause:
- the view is hidden, or an old VSIX is installed

Fix:
- enable the views from Explorer `...` -> `Views`
- reinstall the latest VSIX
- reload VS Code

### Remote SSH: extension cannot reach the API

Cause:
- `localhost` resolves on the remote machine where the extension host runs

Fix:
- run the API on the SSH host, or use a reachable remote URL
- install the extension on the remote side, not only locally

## Demo Pass Criteria

The demo passes when all of these are true:
- VSIX installs successfully
- API URL is configured and health/readiness are green
- login succeeds
- problems load into `OJ Problems`
- a submission is created and appears in `OJ Submissions`
- result can be viewed from the real API
- favorite and review commands succeed
- reload restores session and practice state
