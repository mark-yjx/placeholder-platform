# Runtime Metrics

## Purpose

Runtime metrics describe measured execution characteristics of a judged submission.
They are part of the persisted submission result, not a UI-only convenience.

## Metric Contract

The platform currently exposes two runtime metrics:

- `timeMs`
- `memoryKb`

Both metrics are optional.

- If a metric is measured, it is stored and returned as a numeric value.
- If a metric is unavailable, it remains unavailable.
- Unavailable metrics must not be rewritten to `0`.

## Where Metrics Are Measured

`apps/judge-worker` is responsible for measurement.

- `timeMs` is derived from the judged execution duration around the sandbox run.
- `memoryKb` is captured from the sandbox when the runtime can read a real peak-memory value.

The current Docker wrapper checks the cgroup files in this order:

```text
/sys/fs/cgroup/memory.peak
/sys/fs/cgroup/memory.max_usage_in_bytes
/sys/fs/cgroup/memory/memory.max_usage_in_bytes
```

When none of those sources yields a numeric value, `memoryKb` stays unavailable.

## Propagation Path

Measured metrics flow through the backend without being flattened:

1. the worker captures metrics during sandbox execution
2. the infrastructure/application layers persist optional values
3. the student API and admin system expose the stored values
4. the extension and admin-facing UIs render measured values or an unavailable state

## Rendering Rules

UI surfaces should use engineering-friendly display rules:

- measured `timeMs` renders as milliseconds
- measured `memoryKb` renders as kilobytes
- unavailable values render as `N/A` or `Not available`
- student-visible and admin-visible views should follow the same measured-vs-unavailable distinction

## Relationship To Submission State

Runtime metrics belong to normal judged outcomes.

- `finished` submissions may include verdict plus measured metrics
- `failed` submissions may have no runtime metrics at all

The absence of a metric is not itself an error. It means the runtime did not produce a trustworthy
measurement for that field.
