# Sidebar-First Workflow QA Checklist

Use this checklist to verify the interactive sidebar workflow without using the command palette.

## Preconditions

- Local stack is running (`npm run local:up`).
- Database and seeds are ready (`npm run local:db:setup`).
- Extension is installed and activated.
- `oj.apiBaseUrl` points to `http://localhost:3100`.

## Steps

1. In the `Account` sidebar view, click `Login` and authenticate with a student account.
2. In the `Account` sidebar view, click `Fetch Problems`.
3. In the `Problems` sidebar view, click a problem to open its `Problem Detail` panel.
4. In `Problem Detail`, click `Open Starter` to open `.oj/problems/<problemId>.py`.
5. Edit the starter file in the editor.
6. In `Problem Detail`, click `Submit Current File`.
7. In the `Submissions` sidebar view, click the new submission entry.
8. Verify `Submission Detail` updates through statuses `queued` -> `running` -> `finished|failed`.
9. Verify terminal details show verdict/time/memory or failure reason.

## Pass Criteria

- The full login -> fetch -> open -> submit -> result flow is completed from sidebar UI only.
- No command palette action is required for the core workflow.
- Submission extraction follows the problem `entryFunction` contract from problem metadata.
- The edited Python file defines the configured entry function (for example `collapse(...)` when `entryFunction` is `collapse`).
