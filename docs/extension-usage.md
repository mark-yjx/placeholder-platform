# Extension Usage

## Purpose And Boundary

The VS Code extension is the student workflow surface.

It is responsible for:

- student sign-in/session entry through the account surface
- published problem discovery
- local coding files under `.oj/problems/`
- local public-test execution
- submission to the student API
- student-visible submission history and detail views

It is not responsible for:

- hidden test visibility
- admin-only problem management
- cross-user submission inspection
- admin authentication

## Main UI Surfaces

| Surface | Purpose |
| --- | --- |
| Status bar account entry | Open the account/session UI |
| Account webview | Sign in, sign out, and session-facing student information |
| `Problems` sidebar | Browse published problems |
| `Problem Detail` webview | Statement, starter metadata, and actions |
| `Submissions` panel | Recent submission list and lifecycle state |
| `Submission Detail` webview | Final verdict, runtime metrics, and failure detail |

## Typical Student Workflow

1. Open the account surface and sign in as a student.
2. Refresh the `Problems` view.
3. Select a problem to load `Problem Detail`.
4. Open or create `.oj/problems/<problemId>.py`.
5. Optionally run public tests locally.
6. Submit the current file to the student API.
7. Watch the submission move through `queued -> running -> finished | failed`.
8. Inspect the final verdict, runtime metrics, and any failure detail in `Submission Detail`.

## Working With Problems

The extension uses imported problem data from the student API:

- statement markdown
- `entryFunction`
- student-visible examples
- student-visible public tests

The local coding file path is stable:

```text
.oj/problems/<problemId>.py
```

The starter file is created from the imported `starter.py` content when it does not already exist.

## Public Tests Vs Hidden Tests

The extension can run public tests locally because they are part of the student-visible problem payload.

Hidden tests are different:

- they are stored server-side
- they are used by the judge worker during actual judging
- they can affect the final verdict
- they are never shown in the extension

## Submission Feedback

Student-visible submission feedback includes:

- submission status
- verdict when available
- `timeMs` when measured
- `memoryKb` when measured
- failure information for non-verdict failures

If memory is unavailable, the UI renders `N/A` or `Not available`. The extension must not
invent `0KB` as a fallback.

## Authentication Boundary

- Student authentication belongs to the student API and the extension account flow.
- Admin accounts should use Admin Web instead of the extension.
- The extension remains a student-only client even though it reads from the same underlying platform data.

See [runtime-metrics.md](./runtime-metrics.md) for metric semantics and
[judge-pipeline.md](./judge-pipeline.md) for lifecycle details.
