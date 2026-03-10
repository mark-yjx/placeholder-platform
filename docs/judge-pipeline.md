# Judge Pipeline

## Purpose

The judge pipeline turns a submitted Python solution into durable result data that the
student extension and admin system can display.

## Actors

- `apps/vscode-extension`: submits student code and polls for results
- `apps/api`: validates requests, stores submissions, and enqueues judge jobs
- Postgres: stores submissions, jobs, imported problem versions, and judge results
- `apps/judge-worker`: claims jobs, executes submissions, and persists outcomes
- Docker sandbox: isolates the actual Python execution

## Submission Lifecycle

The lifecycle is:

```text
queued -> running -> finished | failed
```

### `queued`

The student API accepted the submission, stored it, and inserted a judge job.

### `running`

The worker claimed the job and started the judge path for the imported problem version.

### `finished`

The run reached a normal judge outcome. A verdict may be accompanied by measured runtime metrics.

### `failed`

The pipeline could not complete the normal judge path because of a non-verdict problem such as
missing judge configuration or another worker/runtime failure.

## Verdicts

Normal judged outcomes use the standard verdict set:

- `AC`
- `WA`
- `CE`
- `RE`
- `TLE`

`finished` means the pipeline produced a judged result. `failed` means the pipeline itself broke
before it could produce a normal verdict.

## Execution Flow

1. The student API stores the submission as `queued`.
2. The API inserts a row in `judge_jobs`.
3. The worker claims the job and marks the submission `running`.
4. The worker loads the imported problem version, including `entryFunction`,
   examples, public tests, hidden tests, and limits.
5. The worker builds the judged Python payload.
6. The worker executes the payload inside Docker.
7. The worker records a verdict and any measured runtime metrics, or marks the submission `failed`.
8. The student API serves the stored result to the extension.

## Public Vs Hidden Tests

Imported problem versions split tests into two visibility levels:

- `publicTests`: student-visible and eligible for local extension execution
- `hidden.json` data: judge-only and never exposed through student-facing payloads

Hidden tests are part of the real backend judge contract. They may change the final verdict even
when a submission passes all visible cases.

## Runtime Metrics

The judge path may persist two measured metrics:

- `timeMs`
- `memoryKb`

These metrics remain optional:

- when measured, they are returned as values
- when unavailable, they stay unavailable
- unavailable metrics are not rewritten to `0`

See [runtime-metrics.md](./runtime-metrics.md) for measurement details and UI expectations.

## Persistence Rules

Postgres stores:

- submission lifecycle state
- judge jobs
- imported problem versions and tests
- terminal judge results
- failure information for `failed` submissions

The stored result becomes the source of truth for both the student extension and admin-facing views.
