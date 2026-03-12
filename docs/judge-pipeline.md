# Judge Pipeline

The judge pipeline turns a submitted Python solution into a persisted submission state and, when the normal judge path completes, a persisted verdict with optional runtime metrics and feedback.

## Submission Lifecycle

The submission lifecycle is:

```text
queued -> running -> finished | failed
```

### `queued`

The student API has accepted the submission, stored it, and inserted a judge job.

### `running`

The judge worker has claimed the job and started processing it.

### `finished`

The worker completed the normal judging path and persisted a verdict.

### `failed`

The worker could not complete the normal judge path because of a worker-side or pipeline-side failure.

## Verdicts

Verdicts apply to `finished` submissions.

### `AC`

Accepted. All executed tests matched the expected output.

### `WA`

Wrong Answer. The program ran, but at least one executed test produced the wrong output.

### `CE`

Compile Error. The submitted source could not be transformed into runnable judged code for the configured `entryFunction`.

### `RE`

Runtime Error. The judged program ran and failed during execution.

### `TLE`

Time Limit Exceeded. The judged program exceeded the configured time budget.

## `finished` Versus `failed`

This distinction is important:

- `finished` means the judge reached a normal verdict path
- `failed` means the pipeline itself failed before a normal verdict was produced

Examples:

- wrong output on a hidden test: `finished` with `WA`
- runtime exception in student code: `finished` with `RE`
- missing imported problem assets: `failed`
- worker-side persistence or orchestration failure: `failed`

## Problem Data Used By The Worker

The canonical problem schema is:

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

The worker relies on:

- `entryFunction`
- `timeLimitMs`
- `memoryLimitKb`
- `publicTests` from `manifest.json`
- hidden tests from `hidden.json`

Doctest is not part of the judge path. `starter.py` is starter code only and is not a test source.

## Public And Hidden Test Execution

Judge execution uses:

- public tests from `manifest.json.publicTests`
- hidden tests from `hidden.json`

Public tests are visible to students and may also be used by the extension for local public-test runs.

Hidden tests are:

- judge-only at execution time
- admin-only for inspection
- never exposed through student-facing APIs or the extension

This allows a submission to pass visible checks and still receive `WA` on hidden coverage.

## Wrong-Answer Feedback Policy

### Public Failure Feedback

If a public test fails, student-facing feedback may include:

- case index
- input
- expected output
- actual output
- diff

Example:

```json
{
  "kind": "public",
  "caseIndex": 1,
  "input": "112233",
  "expected": "123",
  "actual": "1223",
  "diff": "- 123\n+ 1223"
}
```

### Hidden Failure Feedback

If a submission only fails hidden tests, student-facing feedback must not include:

- hidden case index
- hidden input
- hidden expected output
- hidden actual output
- diff

Student-facing hidden failure feedback is limited to:

```json
{
  "kind": "hidden",
  "message": "Wrong answer on hidden tests."
}
```

Admin inspection may reveal more operational detail through Admin Web and `admin-api`, but that does not change the student-facing disclosure rules.

## Runtime Metrics

Judged results may include:

- `timeMs`
- `memoryKb`

These metrics preserve measured-versus-unavailable semantics:

- measured values stay measured
- unavailable values remain unavailable
- unavailable metrics must not be rewritten to `0`

Student-facing UIs should render unavailable metrics as `N/A` or an equivalent neutral placeholder.

## End-To-End Flow

1. The extension submits code to the student API.
2. The API stores the submission as `queued`.
3. The API inserts a judge job.
4. The worker claims the job and moves the submission to `running`.
5. The worker loads the imported problem assets and limits.
6. The worker builds runnable judged code for the configured `entryFunction`.
7. The worker executes the judged code in Docker against public tests and hidden tests.
8. The worker persists either:
   - `finished` plus a verdict, or
   - `failed` plus a failure reason
9. The student API serves the stored result back to the extension.

## Persistence Rules

Postgres stores:

- submissions and lifecycle state
- judge queue rows
- imported public tests
- imported hidden tests
- final judge results
- failure reasons where applicable

Terminal states are immutable. A submission that has reached `finished` or `failed` must not be rewritten into a different terminal state later.
