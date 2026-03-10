# Problem Format

## Canonical Problem Folder

Each repository-authored problem lives under:

```text
problems/<problemId>/
  manifest.json
  statement.md
  starter.py
  hidden.json
```

## `manifest.json`

`manifest.json` is the student-visible metadata and public test contract for a problem version.

Required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `problemId` | string | Stable repository and runtime identifier |
| `title` | string | Student-facing problem title |
| `entryFunction` | string | Python function the judge and public-test runner call |
| `language` | string | Current repository contract is Python |
| `timeLimitMs` | number | Judge time limit |
| `memoryLimitKb` | number | Judge memory limit |
| `visibility` | string | Publication state, typically `public` |
| `examples` | array | Student-visible examples used in statements and clients |
| `publicTests` | array | Student-visible executable public tests |

Common optional fields:

- `difficulty`
- `tags`
- `version`
- `author`

## `statement.md`

`statement.md` is the authoritative student-facing problem statement.

It should document:

- the task definition
- input/output expectations
- examples aligned with the manifest examples
- constraints that matter to the student solution

## `starter.py`

`starter.py` is the student editing baseline.

It should:

- define the configured `entryFunction`
- be safe to copy into `.oj/problems/<problemId>.py`
- contain the starter implementation shape expected by the problem

## `hidden.json`

`hidden.json` contains judge-only test coverage.

Those tests:

- are imported into Postgres
- are executed by the worker during real judging
- are never returned through the student API
- are never rendered in the extension

## Public Vs Hidden Tests

The visibility split is intentional:

- `examples` and `publicTests` are student-visible
- hidden tests are judge-only

This lets the extension run public tests locally while preserving a real backend verdict path.

## Import Behavior

`tools/scripts/import-problems.mjs` reads repository-authored problem folders and produces the
runtime problem version used by both the student API and the judge worker.

The importer is responsible for:

- validating `manifest.json`
- loading statement, starter, and hidden tests
- computing a stable content digest
- writing canonical problem versions and tests to Postgres

## Authoring Checklist

- Keep `problemId` stable over time.
- Keep `entryFunction` aligned across `manifest.json`, `starter.py`, and judged execution.
- Keep student-visible examples in sync with the statement.
- Keep hidden tests server-side only.
- Re-import problems after authored changes so the runtime store matches repository content.
