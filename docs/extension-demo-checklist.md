# OJ VSCode Student Smoke Checklist

This checklist verifies the current student shell against the real local stack.

## One-Command Demo

Use this command for the supported local demo path:

```bash
npm run smoke:local
```

What it does:
- builds and exercises the extension login/fetch/submit flow against the live API
- starts the compose-managed stack
- applies schema and seed data
- imports sample problems from `data/problems`
- rejects submissions without a top-level `solve()` before sending a valid payload
- waits for API readiness instead of relying on fixed startup sleeps
- submits a real solution through the live API and compose worker
- verifies a terminal submission result with no duplicate worker processing

Expected final line:
- `SMOKE PASS`

Use it after:

```bash
npm install
npm run local:up
npm run local:db:setup
```

Local runtime assumptions:
- real API base URL: `http://localhost:3100`
- compose `api` service is the real API runtime
- compose `worker` service is running
- do not start a second host-side `npm run worker:start` for the same local queue
- fixture student login is available through `OJ: Login`

Health check before opening VS Code:

```bash
curl http://localhost:3100/healthz
curl http://localhost:3100/readyz
```

Expected:

```json
{"status":"ok"}
{"status":"ready"}
```

## Student Success Path

### 1. Install and configure the extension

1. Install `apps/vscode-extension/oj-vscode-extension-0.1.0.vsix`.
2. Open Settings JSON.
3. Set:

```json
{
  "oj.apiBaseUrl": "http://localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

Expected:
- the `OJ VSCode` output channel opens on activation
- activation logs show:
  - `OJ VSCode extension activated`
  - `API base URL: http://localhost:3100`
  - `Request timeout: 10000ms`
  - `Auth tokens are stored in VS Code SecretStorage on this machine.`

### 2. Login

1. Run `OJ: Login`.

Expected:
- notification: `[oj.login] success`
- output includes `Authenticated`

### 3. Fetch published problems

1. Run `OJ: Fetch Problems`.

Expected:
- `OJ Problems` and `OJ Submissions` views are available in Explorer
- the problems list is loaded from the real API
- output includes:
  - `[oj.practice.fetchProblems] start`
  - `Problems loaded: <n>`
  - `[oj.practice.fetchProblems] success`

### 4. Open a problem statement and starter file

1. In `OJ Problems`, click a problem item.

Expected:
- the selected problem is revealed in the `OJ Problems` tree
- the statement is shown in VS Code UI for the selected problem
- a local editable starter file opens at `.oj/problems/<problemId>.py`
- the starter file content comes from the backend problem detail, not a hardcoded template

Manual check:
- edit the opened `.oj/problems/<problemId>.py` file and save it

### 5. Submit the current editor file

1. Keep the `.oj/problems/<problemId>.py` file focused.
2. Run `OJ: Submit Current File`.

Expected:
- notification confirms submission success
- output includes `Submitted current file: <submissionId>`
- a new submission row appears immediately in `OJ Submissions`
- the initial submission state is `queued`

### 6. Observe polling through terminal state

Expected without any extra action:
- the same submission row transitions from `queued` to `running`
- the final row transitions to `finished` or `failed`
- polling stops automatically after the terminal state is reached

Optional manual check:
1. Run `OJ: Cancel Polling` while a submission is still `queued` or `running`.
2. Confirm the extension reports cancellation cleanly.

### 7. Inspect the final result

1. Select the submission row in `OJ Submissions`.
2. Run `OJ: Show Submission Detail`.
3. Run `OJ: View Result`.

Expected:
- terminal output and/or result UI shows the current terminal state
- `finished` results show verdict and, when available, time and memory
- `failed` results show a visible failure reason
- no hidden test input or expected output is shown

## Student Failure Path

Use this path to verify error UX without changing backend code.

### 8. Invalid configuration path

1. Change settings JSON to:

```json
{
  "oj.apiBaseUrl": "localhost:3100",
  "oj.requestTimeoutMs": 10000
}
```

2. Reload the VS Code window.

Expected:
- activation fails fast with a clear error message about `oj.apiBaseUrl`
- the output channel includes `Extension configuration error: ...`
- the message tells the student to use a valid `http://` or `https://` URL

### 9. Failed submission path

1. Restore `oj.apiBaseUrl` to `http://localhost:3100`.
2. Reload the VS Code window.
3. Open the starter file again.
4. Replace the current file with a deliberately broken implementation for the selected problem.
5. Run `OJ: Submit Current File`.

Expected:
- the submission still transitions `queued` -> `running` -> `finished|failed`
- if the result is `failed`, `OJ: View Result` shows a non-empty failure reason
- if the result is `finished` with `CE` or `RE`, the extension shows that terminal verdict instead of collapsing it into a generic transport error

## Persistence Check

### 10. Reload the window

1. Run `Developer: Reload Window`.

Expected:
- session token restores from VS Code SecretStorage
- the previously selected problem can be restored
- the last opened `.oj/problems/<problemId>.py` file remains usable
- the last submission id for the selected problem remains available in the submissions view

## Pass Criteria

The checklist passes when all of the following are true:
- login, fetch, open, edit, submit, poll, and result inspection all work against `http://localhost:3100`
- the extension uses the real HTTP API path, not in-memory clients
- a submission visibly transitions `queued` -> `running` -> `finished|failed`
- a student can see a terminal verdict or a visible failure reason
- hidden tests are not exposed in any extension UI
