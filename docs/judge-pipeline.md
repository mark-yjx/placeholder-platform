# Judge Pipeline

The judge pipeline turns a submitted Python source file into a persisted terminal result.

## Submission Lifecycle States

### `queued`

The API accepted the submission, stored it in Postgres, and inserted a judge job into the queue table.

### `running`

The worker claimed the job and started processing it. At this point the worker has loaded the problem's judge configuration and is executing the extracted Python entry function against the problem tests.

### `finished`

The worker completed execution and persisted a terminal verdict and resource usage.

### `failed`

The worker encountered a non-recoverable processing failure outside the normal verdict path, such as missing judge configuration or another execution pipeline failure, and persisted a failure reason.

## Verdicts

### `AC` — Accepted

The submission produced the expected output for all tests.

### `WA` — Wrong Answer

The submission executed successfully but produced incorrect output for at least one test case.

### `CE` — Compile Error

The judged Python source could not be prepared into a runnable form, or the judge configuration was invalid for execution.

### `RE` — Runtime Error

The code ran but exited abnormally or produced runtime failures during test execution.

### `TLE` — Time Limit Exceeded

This is the standard online-judge verdict for submissions that exceed the configured time limit. The repository models `TLE` in its verdict set, even though the current local Python execution path primarily emits `AC`, `WA`, `CE`, and `RE`.

### `MLE` — Memory Limit Exceeded

This is the standard online-judge verdict for submissions that exceed the configured memory limit. The current local runtime documents memory limits and records memory usage, but the present worker path does not yet emit a dedicated `MLE` verdict.

## Hidden Tests

Each problem version contains two categories of tests:

- `public` tests
- `hidden` tests

Hidden tests are:

- stored in Postgres
- loaded by the judge worker
- executed as part of the real verdict
- never returned by student-facing API responses
- never rendered in the VS Code extension

This prevents students from seeing the full judge oracle while still allowing the system to validate correctness beyond the visible examples.

## Runtime Flow

1. The extension sends `POST /submissions`.
2. The API stores the submission as `queued`.
3. The API inserts a judge job into `judge_jobs`.
4. The worker claims the job.
5. The worker updates the submission to `running`.
6. The worker loads:
   - the problem version
   - the configured `entryFunction`
   - public tests
   - hidden tests
7. The worker extracts runnable judged Python source.
8. The worker executes the code in Docker.
9. The worker persists:
   - terminal submission state
   - verdict
   - timing
   - memory
10. The extension polls `/submissions/:submissionId` and shows the terminal result.

## Execution Model

The worker uses a Docker-backed sandbox and Python runner plugin. The current problem contract is driven by the problem manifest's `entryFunction`, not by a hardcoded `solve()` assumption.

That means the judged source is built from:

- the student's submitted file
- the configured top-level entry function
- only the helper code needed to execute that entry function safely

## Persistence Model

Postgres stores:

- the submission row and lifecycle state
- the judge job queue row
- the persisted terminal result
- the imported problem tests and judge metadata

This allows the extension to reconnect, poll again, and recover the latest persisted state after reloads or process restarts.
