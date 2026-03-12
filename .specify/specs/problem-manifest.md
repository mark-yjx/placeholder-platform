# Problem Manifest

## Purpose

The OJ system uses a manifest-first problem architecture and defines the canonical repository-authored problem contract.

Canonical repository-authored problem folders live under `problems/<problemId>/`.

Each problem has an explicit `manifest.json` as the single source of truth for metadata and public authoring-facing test data.
Statement content, starter code, and hidden judge tests live in adjacent files and are mapped into one canonical problem definition used across:

- import pipeline
- API
- extension
- judge worker
- database persistence

This architecture removes old coupling to doctest and standalone `public.json`.
Every problem must declare its own `entryFunction`.

## Canonical Problem Folder Structure

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    hidden.json
```

## `manifest.json` Required Fields

`manifest.json` is the single source of metadata.

It must define:

- `problemId`
- `title`
- `language`
- `entryFunction`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`
- `examples`
- `publicTests`

## `manifest.json` Optional Fields

- `difficulty`
- `tags`
- `version`
- `author`

## Public Test Case Shape

`examples` and `publicTests` use the same logical case shape:

```json
{
  "input": "112233",
  "output": "123"
}
```

Contract rules:

- `input` is stored as text
- `output` is stored as text
- examples are student-visible
- public tests are student-visible authoring/runtime contract data
- hidden tests are never embedded in `manifest.json`

## Canonical Problem Definition

The full canonical problem definition used by the system is the combination of:

- metadata, examples, and public tests from `manifest.json`
- statement content from `statement.md`
- starter code from `starter.py`
- hidden judge tests from `hidden.json`

Canonical logical fields:

- `problemId`
- `title`
- `statementMarkdown`
- `entryFunction`
- `language`
- `starterCode`
- `examples`
- `publicTests`
- `hiddenTests`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`
- optional:
  - `difficulty`
  - `tags`
  - `version`
  - `author`

## Canonical JSON Representation

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "entryFunction": "collapse",
  "language": "python",
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "visibility": "public",
  "difficulty": "easy",
  "tags": ["digits", "iteration"],
  "version": "1.0.0",
  "author": "COMP9021 Staff",
  "statementMarkdown": "# Collapse Identical Digits\n\nWrite a function `collapse(number)` that ...",
  "starterCode": "def collapse(number: int) -> int:\n    \"\"\"Collapse identical digits.\"\"\"\n    # Write your code here.\n",
  "examples": [
    {
      "input": "111",
      "output": "1"
    }
  ],
  "publicTests": [
    {
      "input": "112233",
      "output": "123"
    }
  ],
  "hiddenTests": [
    {
      "input": "111122223333",
      "output": "123"
    }
  ]
}
```

## Example `manifest.json`

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "language": "python",
  "entryFunction": "collapse",
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "visibility": "public",
  "examples": [
    { "input": "111", "output": "1" }
  ],
  "publicTests": [
    { "input": "112233", "output": "123" }
  ]
}
```

## File Responsibilities

- `manifest.json`
  - defines problem metadata
  - defines `examples`
  - defines `publicTests`
  - is the single source of truth for metadata and public test data
- `statement.md`
  - contains only the human-readable markdown problem statement
  - maps to `statementMarkdown`
- `starter.py`
  - contains only starter code, function signatures, and comments
  - contains no doctest
  - contains no embedded tests
  - maps to `starterCode`
- `hidden.json`
  - contains hidden judge-only tests
  - maps to `hiddenTests`

## Public Vs Hidden Test Contract

- `examples` are student-visible examples.
- `publicTests` are student-visible execution cases.
- `hidden.json` contains hidden tests that remain server-side only.
- Hidden tests must never be exposed through student-facing APIs, the extension UI, or other public surfaces.

## Import Responsibilities

The importer is responsible for loading the canonical repository-authored problem definition, validating it, and preserving the declared execution contract.

## Layer Responsibilities

### Import Pipeline

- Reads `manifest.json` first.
- Resolves sibling files `statement.md`, `starter.py`, and `hidden.json`.
- Builds one canonical problem definition from those files.
- Rejects the import if:
  - `manifest.json` is missing
  - a required manifest field is missing
  - required sibling files are missing
  - `hidden.json` is malformed
  - `examples` or `publicTests` are malformed
  - `entryFunction` does not describe the intended callable contract
  - `entryFunction` is not aligned with the callable defined in `starter.py`

### API

- Validates manifest-driven problem fields before persistence/publication.
- Persists manifest-aligned metadata, statement content, starter code, public tests, hidden tests, and limits.
- Serves problem detail using manifest-driven fields.
- Student-facing problem detail may expose:
  - `problemId`
  - `title`
  - `statementMarkdown`
  - `entryFunction`
  - `language`
  - `starterCode`
  - `examples`
  - `publicTests`
  - limits/visibility fields that are intentionally public
- Hidden tests must never be exposed by public/student-facing APIs.

### Extension

- Uses summary data from `fetchProblems` for the problem list.
- Uses manifest-driven problem detail data for the student workflow.
- Uses `examples` for student-visible examples when present.
- Uses `entryFunction` from problem detail as the source of truth for submission extraction.
- Must not assume a fixed `solve()`.
- Must not rely on doctest embedded in `starter.py`.

### Worker

- Uses `entryFunction`, `publicTests`, and `hiddenTests` from manifest-imported problem data.
- Executes public and hidden tests through the same declared entrypoint contract.
- Applies `timeLimitMs` and `memoryLimitKb` from manifest-imported problem data.
- Submission state terminology remains exact:
  - `queued -> running -> finished | failed`
- Terminal states remain immutable.

### Database Persistence

- Stores manifest-aligned metadata and enough related data to reconstruct a canonical problem definition.
- May normalize storage across tables, but reconstructed problem detail must remain manifest-driven.
- Hidden tests must remain non-public and must not leak through student-facing read models.

## Submission Contract

- The judged callable is `problem.entryFunction`.
- No component may assume a fixed `solve()`.
- Submission extraction must:
  - locate the top-level function matching `entryFunction`
  - include same-level helper definitions referenced by that function
  - exclude doctest execution blocks
  - exclude embedded test code
  - exclude `__main__` execution blocks

## Invariants

- Every problem must be reconstructible from the manifest-based folder structure.
- `manifest.json` is authoritative for metadata, examples, and public tests.
- `statement.md`, `starter.py`, and `hidden.json` are authoritative for their respective content areas.
- Hidden tests must never be exposed to students.
- `starter.py` contains no doctest and no embedded tests.
- Domain rules remain framework-independent.
- Submission lifecycle remains `queued -> running -> finished | failed`, with immutable terminal states.
