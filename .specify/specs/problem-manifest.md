# Problem Manifest

## Purpose

This spec defines the canonical repository-authored problem contract that is imported into Postgres
and later consumed by the student API, admin system, and judge worker.

## Canonical Folder Layout

```text
problems/<problemId>/
  manifest.json
  statement.md
  starter.py
  hidden.json
```

## Required `manifest.json` Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `problemId` | string | Stable identifier |
| `title` | string | Student-facing name |
| `entryFunction` | string | Function executed by public tests and the judge |
| `language` | string | Current contract is Python |
| `timeLimitMs` | number | Execution time limit |
| `memoryLimitKb` | number | Execution memory limit |
| `visibility` | string | Publication state |
| `examples` | array | Student-visible examples |
| `publicTests` | array | Student-visible executable tests |

## Common Optional Fields

- `difficulty`
- `tags`
- `version`
- `author`

## File Responsibilities

- `statement.md`: student-facing problem statement
- `starter.py`: editable student baseline with the configured `entryFunction`
- `hidden.json`: judge-only tests
- `manifest.json`: public metadata, examples, public tests, and execution contract

## Public Vs Hidden Test Contract

- `examples` and `publicTests` are student-visible
- hidden tests remain judge-only
- hidden tests may affect verdicts
- hidden tests must not be returned through student-facing payloads

## Import Responsibilities

The importer must:

- validate required fields
- load statement, starter, and hidden tests
- preserve the configured `entryFunction`
- write a canonical problem version into Postgres

## Invariants

- `problemId` stays stable over time
- `entryFunction` stays aligned across manifest, starter, and judged execution
- student-visible examples remain safe to expose
- hidden tests remain server-side only
