# Problem Manifest

## Purpose

The Placeholder Platform uses a Problem Manifest architecture.

Each problem has an explicit `manifest.json` as the single source of truth for problem metadata.
Statement content, starter code, and tests live in adjacent files and are mapped into one canonical problem definition used across:

- import pipeline
- API
- extension
- judge worker
- database persistence

This architecture removes implicit assumptions such as a fixed `solve()` entrypoint.
Every problem must declare its own `entryFunction`.

## Canonical Problem Folder Structure

```text
problems/
  <problemId>/
    manifest.json
    statement.md
    starter.py
    public.json
    hidden.json
```

## `manifest.json` Required Fields

- `problemId`
- `title`
- `entryFunction`
- `language`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`

## `manifest.json` Optional Fields

- `examples`
- `difficulty`
- `tags`
- `version`
- `author`

## Canonical Problem Definition

The full canonical problem definition used by the system is the combination of:

- metadata from `manifest.json`
- statement content from `statement.md`
- starter code from `starter.py`
- visible tests from `public.json`
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
  "examples": [
    {
      "input": 111122223333,
      "output": 123
    }
  ],
  "difficulty": "easy",
  "tags": ["digits", "iteration"],
  "version": "1.0.0",
  "author": "Placeholder Staff",
  "statementMarkdown": "# Collapse Identical Digits\n\nWrite a function `collapse(number)` that ...",
  "starterCode": "def collapse(number):\n    raise NotImplementedError\n",
  "publicTests": [
    {
      "input": [122344],
      "expected": 1234
    }
  ],
  "hiddenTests": [
    {
      "input": [111111],
      "expected": 1
    }
  ]
}
```

## Example `manifest.json`

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "entryFunction": "collapse",
  "language": "python",
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "visibility": "public",
  "examples": [
    {
      "input": 111122223333,
      "output": 123
    }
  ],
  "difficulty": "easy",
  "tags": ["digits", "iteration"],
  "version": "1.0.0",
  "author": "Placeholder Staff"
}
```

## File Responsibilities

- `manifest.json`
  - defines problem metadata
  - is the single source of truth for metadata
- `statement.md`
  - contains the markdown problem statement
  - maps to `statementMarkdown`
- `starter.py`
  - contains the editable student starter code
  - maps to `starterCode`
- `public.json`
  - contains visible tests
  - maps to `publicTests`
- `hidden.json`
  - contains hidden judge tests
  - maps to `hiddenTests`

## Layer Responsibilities

### Import Pipeline

- Reads `manifest.json` first.
- Resolves sibling files `statement.md`, `starter.py`, `public.json`, and `hidden.json`.
- Builds one canonical problem definition from those files.
- Rejects the import if:
  - `manifest.json` is missing
  - a required manifest field is missing
  - required sibling files are missing
  - JSON test files are malformed
  - `entryFunction` does not describe the intended callable contract

### API

- Validates manifest-driven problem fields before persistence/publication.
- Persists manifest-aligned metadata, statement content, starter code, tests, and limits.
- Serves problem detail using manifest-driven fields.
- `fetchProblems` may return summary data only:
  - `problemId`
  - `title`
- Problem detail responses must be manifest-driven and include the fields needed by the extension and judge pipeline.
- Hidden tests must never be exposed by public/student-facing APIs.

### Extension

- Uses summary data from `fetchProblems` for the problem list.
- Uses manifest-driven problem detail data for the sidebar/detail panel.
- Uses `entryFunction` from the manifest-driven problem detail as the source of truth for submission extraction.
- Must not assume a fixed `solve()`.

### Worker

- Uses `entryFunction` and test definitions from manifest-imported problem data.
- Executes public/hidden tests through the same declared entrypoint contract.
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
  - exclude `__main__` execution blocks

## Invariants

- Every problem must be reconstructible from the manifest-based folder structure.
- `manifest.json` is authoritative for metadata.
- `statement.md`, `starter.py`, `public.json`, and `hidden.json` are authoritative for their respective content areas.
- Hidden tests must never be exposed to students.
- Domain rules remain framework-independent.
- Submission lifecycle remains `queued -> running -> finished | failed`, with immutable terminal states.
