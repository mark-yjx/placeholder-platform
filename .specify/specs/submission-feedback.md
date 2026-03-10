# Submission Feedback

## Purpose

This spec defines the stored and user-visible feedback contract for submission results.

It covers:

- lifecycle status
- verdicts
- runtime metrics
- failure information
- hidden-test visibility rules

## Submission Status Contract

The canonical lifecycle is:

```text
queued -> running -> finished | failed
```

- `queued`: accepted by the student API and waiting for the worker
- `running`: claimed by the worker and currently being judged
- `finished`: reached the normal judge contract and may include a verdict
- `failed`: the judge pipeline broke before a normal verdict could be produced

## Verdict Contract

Normal judged outcomes may report:

- `AC`
- `WA`
- `CE`
- `RE`
- `TLE`

Verdicts belong to `finished` submissions, not `failed` submissions.

## Runtime Metrics Contract

The result contract may include:

- `timeMs`
- `memoryKb`

These fields are optional measured values.

- measured values are persisted and returned as numbers
- unavailable values remain absent
- unavailable values are not rewritten to `0`

## Failure Information

`failed` submissions may include pipeline-facing failure information such as:

- missing judge configuration
- worker/runtime failure
- other non-verdict execution problems

Failure detail should explain why a normal verdict was not produced.

## Visibility Rules

Student-visible feedback may include:

- status
- verdict
- measured runtime metrics
- student-safe failure detail

Student-visible feedback must not include:

- hidden test inputs
- hidden expected outputs
- admin-only operational data

Admin-facing tools may inspect more operational context, but the hidden-test boundary still remains server-side.
