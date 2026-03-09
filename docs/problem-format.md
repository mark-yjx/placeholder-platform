# Problem Format

Problems are authored in the repository under `problems/` and imported into Postgres with the problem importer.

## Problem Folder Layout

Each problem directory must contain:

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

Example:

```text
problems/
  collapse/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

## `manifest.json`

`manifest.json` is the single source of metadata and public authoring-facing test data.

Required fields:

- `problemId`
- `title`
- `language`
- `entryFunction`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`
- `publicTests`

Supported optional fields:

- `difficulty`
- `tags`
- `version`
- `author`

Current field expectations:

- `problemId`: non-empty string
- `title`: non-empty string
- `language`: must be `"python"` for the current platform
- `entryFunction`: non-empty valid Python identifier
- `timeLimitMs`: positive integer
- `memoryLimitKb`: positive integer
- `visibility`: must be `"public"` or `"private"`
- `publicTests`: array of `{ input: <json>, output: <json> }`

Example:

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "language": "python",
  "entryFunction": "collapse",
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "visibility": "public",
  "publicTests": [
    { "input": 112233, "output": 123 }
  ]
}
```

## `statement.md`

`statement.md` contains only the human-readable problem statement.

It should contain:

- the task description
- constraints or clarifications
- narrative explanation intended for students

It must not contain:

- hidden tests
- embedded judge-only fixtures
- implementation-only metadata

## `starter.py`

`starter.py` is the starter file materialized for students.

It must:

- define the function named by `entryFunction`
- contain no doctest
- contain no embedded tests
- contain only function signatures, docstrings, and comments appropriate for starter code

Example:

```python
def collapse(number: int) -> int:
    """Collapse identical digits."""
    # Write your code here.
```

Important:

- there is no fixed `solve()` assumption at the authoring layer
- the configured `entryFunction` is the canonical function contract
- the extension and worker must preserve that explicit function contract

## `hidden.json`

`hidden.json` contains hidden judge-only tests.

Shape:

```json
[
  { "input": 111122223333, "output": 123 }
]
```

These tests:

- are imported into Postgres
- are executed by the worker
- affect final verdicts
- must never be exposed through student-facing APIs or the extension UI

## Public Tests vs Hidden Tests

Public tests now live inside `manifest.json`.

That means:

- there is no standalone `public.json` in the canonical format
- public tests are defined in `manifest.json`
- hidden tests remain isolated in `hidden.json`

## Import Behavior

The importer reads each problem directory in this order:

1. `manifest.json`
2. `statement.md`
3. `starter.py`
4. `hidden.json`

It then:

- validates the manifest
- validates `publicTests`
- validates `hidden.json`
- computes a content digest
- creates or appends a Postgres problem version
- persists metadata, statement, starter code, public tests, and hidden tests

## Authoring Guidelines

- Keep `entryFunction` and `starter.py` aligned.
- Keep `statement.md` purely student-facing.
- Put public transparent checks in `publicTests`.
- Put judge-only coverage in `hidden.json`.
- Keep `starter.py` free of doctest and embedded test code.
- Prefer stable, source-controlled problem content over manual database edits.
