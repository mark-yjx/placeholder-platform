# Judge Pipeline

The judge pipeline turns a submitted solution into a persisted result that the extension can display.

## Submission Lifecycle

The submission lifecycle is:

`queued -> running -> finished | failed`

### `queued`

The API has accepted the submission, stored it in Postgres, and inserted a judge job.

### `running`

The judge worker has claimed the job and started processing it.

### `finished`

The worker completed judging and persisted a verdict with any runtime metrics that were actually available for that judged run.

### `failed`

The submission could not complete the normal judge path because of a non-verdict processing failure, such as missing judge configuration or another worker-side failure.

## Verdicts

### `AC`

Accepted. All tests matched the expected outputs.

### `WA`

Wrong Answer. The program ran, but at least one test output did not match the expected result.

### `CE`

Compile Error. The judged Python payload could not be prepared into runnable judged code.

### `RE`

Runtime Error. The program started but crashed during execution.

### `TLE`

Time Limit Exceeded. The execution exceeded the configured time budget.

## Hidden Tests

Each imported problem version stores:

- `public.json` for visible example-style tests
- `hidden.json` for judge-only validation

Hidden tests are part of the real judge path:

- they are imported into Postgres with the problem version
- they are executed by the worker during judging
- they affect the final verdict
- they are not returned to student-facing problem APIs
- they are not shown in the extension UI

This means a submission can satisfy visible examples and still receive `WA` on hidden coverage.

## Runtime Metrics

The judge pipeline tracks two runtime metrics for normal judged outcomes:

- `time`
- `memory`

`time` is the execution time recorded for the judged run.

`memory` is the memory usage recorded for the judged run when the sandbox can measure it.

These metrics are not placeholders. They only represent measured runtime data when the runtime actually produced that data.

If a metric is unavailable, the system keeps it unavailable instead of converting it to `0`. That distinction matters:

- `0` means the metric value is explicitly zero
- unavailable means the metric was not measured or could not be reported

Student-facing and extension-facing displays should therefore show unavailable metrics as unavailable, not as `0`.

## Execution Flow

1. The extension sends a submission to the API.
2. The API stores the submission as `queued`.
3. The API inserts a judge job into Postgres.
4. The worker claims the job and marks the submission `running`.
5. The worker loads the problem version, entry function, and public/hidden tests.
6. The worker prepares judged Python code for the configured entry function.
7. The worker runs that code inside a sandbox.
8. The worker persists the verdict, time, and memory for normal judged outcomes when those metrics are available.
9. The worker persists `failed` plus a failure reason for non-verdict failures.
10. The extension polls the API and renders the result.

## Sandbox Execution

The worker runs student code in a Docker-backed sandbox. The sandbox exists to provide:

- isolated execution
- controlled runtime behavior
- resource limits
- a real backend judge path instead of a client-only simulation

The worker uses the problem manifest’s configured `entryFunction` and the imported tests for the specific problem version being judged.

## Persistence Model

Postgres stores:

- submission rows and lifecycle state
- queue rows for pending judge work
- imported public and hidden tests
- terminal judge results
- failure reasons when the submission ends in `failed`

Persisted judge results keep the distinction between measured metrics and unavailable metrics. An unavailable memory reading is not stored or documented as `0`.

That persisted state is what allows the extension to restore and poll recent results across reloads.
