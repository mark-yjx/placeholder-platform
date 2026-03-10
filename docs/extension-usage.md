# Extension Usage

This guide describes the primary student workflow in the current VS Code extension.

## Product Boundary

The VS Code extension is student-only.

Administrators should no longer use the extension. Admin workflows belong in Admin Web.

That means the extension is responsible for student workflows such as:

- launching student sign up and sign in
- fetch problems
- view problem detail
- open starter files
- run public tests locally
- submit solutions
- view the student's own submissions

Admin workflows such as problem CRUD, hidden test editing, and cross-user submission inspection belong in Admin Web instead.

The extension should eventually reject admin-role logins so the runtime behavior matches this documented product boundary.

## Current UI Layout

The extension uses these surfaces:

- status bar icon for account access
- account webview window for browser sign-in, stats, badges, and logout
- `Problems` sidebar tree
- `Problem Detail` webview
- `Submissions` panel tree
- `Submission Detail` webview

## Planned Student Auth MVP

Planned student authentication direction:

- the extension exposes `Sign in` and `Sign up` actions
- clicking either action opens the system browser
- registration and login happen on browser pages backed by the Node/TypeScript API
- the extension provides a callback URI and state for the auth attempt
- after successful auth, the browser redirects back to VS Code automatically
- the extension validates callback state and completes sign-in automatically
- editor-area login is deprecated

Planned primary completion method:

- the browser callback carries only short-lived completion data, not the final long-lived student token when avoidable
- the extension exchanges that short-lived completion data for the real student session/token

Fallback:

- if callback completion fails, the browser may still show a one-time manual code
- manual code entry remains fallback-only, not the primary UX

This keeps the extension student-only while moving credential entry and registration UX to the browser.

## Current Login Via Status Bar Icon

1. Look for the OJ account icon in the VS Code status bar.
2. Click the icon to open the account window.
3. Click `Sign in` or `Sign up`.
4. Complete auth in the system browser.
5. Return to VS Code automatically through the callback flow.

On success:

- the access token is stored in VS Code `SecretStorage`
- later API requests use that token
- the account view refreshes to show the authenticated user, stats, badges, and the all-time leaderboard

This flow is intended for student accounts. Admin accounts should use Admin Web instead of the extension.

Fallback command:

- `OJ: Open Account`

Fallback path:

- if the callback cannot complete automatically, the account window still supports entering the one-time browser code manually

## Signed-In Account View

When you are signed in, the account window shows:

- solved count
- solved-by-difficulty
- current streak and longest streak
- language breakdown
- tag breakdown
- badge progress
- the current all-time leaderboard

## Fetch or Refresh Problems From the Sidebar

Use the refresh action in the `Problems` view title or run:

- `OJ: Fetch Problems`

This requests the current published problem list from the API and updates the sidebar tree.

## Select a Problem

Click a problem in the `Problems` tree.

That updates the `Problem Detail` webview with:

- title
- problem id
- entry function
- statement markdown

The current UX keeps the selected problem as the context for later actions such as opening the coding file and submitting.

## Run Public Tests Locally

Use the `Run Public Tests` action from `Problem Detail` or run:

- `OJ: Run Public Tests`

The extension loads the selected problem's student-visible `publicTests` and executes them locally against the current Python file using the configured `entryFunction`.

The extension does not scan starter files for doctest and does not run doctest.

## Open the Coding File

Use the `Open Coding File` action from `Problem Detail`.

The extension opens or creates:

```text
.oj/problems/<problemId>.py
```

Behavior:

- existing files are reused
- missing files are created from imported starter content
- the file path stays stable for repeated work on the same problem

## Submit

You can submit in three common ways:

- the `Submit` action in `Problem Detail`
- `OJ: Submit Code`
- `OJ: Submit Current File`

The submit path:

1. reads the current Python file
2. extracts the configured `entryFunction`
3. submits the code to the HTTP API
4. records the new submission in local extension state
5. polls until the result reaches `finished` or `failed`

## View Submissions in the Panel

The bottom `OJ Results` panel contains:

- `Submissions`
- `Submission Detail`

### `Submissions`

Shows recent submissions and their current state. While polling, you should see transitions like:

```text
queued
running
finished with wrong answer (WA), time=865ms, memory=11924KB
```

If memory is unavailable, the UI should show `N/A` rather than `0KB`.

### `Submission Detail`

Selecting a submission shows:

- submission id
- submission status
- verdict if present
- time if available
- memory if available
- failure information if present

## Runtime Metrics In The UI

- measured `timeMs` is shown as milliseconds
- measured `memoryKb` is shown as kilobytes
- unavailable metrics are rendered as `N/A` or `Not available`
- unavailable metrics must not be shown as `0`

## Hidden Tests

The extension never shows hidden tests.

Students may still receive:

- `WA`
- `RE`
- `TLE`

based on hidden tests executed by the worker, but the hidden inputs and expected outputs remain server-side only.

The extension also does not expose admin-only workflows or admin-only hidden failure inspection.

## Typical Workflow

1. Click the status bar account icon.
2. Log in.
3. Refresh `Problems`.
4. Select a problem.
5. Open `.oj/problems/<problemId>.py`.
6. Edit the file.
7. Submit.
8. Watch the panel update through `queued -> running -> finished | failed`.
9. Open `Submission Detail` for the final result.
