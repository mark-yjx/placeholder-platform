# Problem Format

Problems are stored on disk as manifest-based folders under `problems/`.

## Folder Structure

```text
problems/
  collapse/
    manifest.json
    statement.md
    starter.py
    public.json
    hidden.json
```

## File Purposes

### `manifest.json`

Defines the problem metadata used by the importer and runtime:

- `problemId`
- `title`
- `entryFunction`
- `language`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`

Optional metadata may include:

- `difficulty`
- `tags`
- `version`
- `author`

### `statement.md`

Student-facing problem statement shown in the VS Code extension.

### `starter.py`

The editable starter file materialized into `.oj/problems/<problemId>.py` for the student workflow.

### `public.json`

Visible example tests used by the judge configuration and documentation-oriented validation.

### `hidden.json`

Private judge-only tests. These are stored and executed by the worker but must not be exposed to students through the API or extension UI.

## Example `manifest.json`

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "entryFunction": "collapse",
  "language": "python",
  "timeLimitMs": 2000,
  "memoryLimitKb": 65536,
  "visibility": "public",
  "difficulty": "easy",
  "tags": ["digits", "iteration"],
  "version": "1.0.0",
  "author": "COMP9021 Staff"
}
```

## Test File Format

Both `public.json` and `hidden.json` are JSON arrays of test case objects:

```json
[
  { "input": 12321, "expected": 12321 },
  { "input": -1111222232222111, "expected": -12321 }
]
```

The importer converts these files into persisted judge test rows associated with a problem version.

## Validation Rules

The importer enforces:

- `problemId` must be a non-empty string
- `title` must be a non-empty string
- `entryFunction` must be a non-empty valid Python identifier
- `language` must currently be `python`
- `visibility` must be `public` or `private`
- `timeLimitMs` must be positive
- `memoryLimitKb` must be positive
- all required sibling files must exist
- `public.json` and `hidden.json` must contain valid JSON arrays of test cases

## Import Flow

The importer:

1. Reads `manifest.json`
2. Loads `statement.md`, `starter.py`, `public.json`, and `hidden.json`
3. Computes a content digest
4. Inserts or appends a problem version in Postgres
5. Stores judge assets and both public and hidden tests

The source of truth for runtime problem content is therefore the versioned filesystem problem folder plus the imported Postgres representation derived from it.
