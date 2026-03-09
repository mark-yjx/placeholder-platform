# Problem Format

Problems are authored in the repository under `problems/` using a manifest-based directory layout.

## Directory Layout

```text
problems/
  collapse/
    manifest.json
    statement.md
    starter.py
    public.json
    hidden.json
```

Each problem folder is the source-controlled definition for an importable problem version.

## Files

### `manifest.json`

The metadata file for the problem. It defines the identity and runtime contract used by the importer, API, extension, and worker.

Typical fields include:

- `problemId`
- `title`
- `entryFunction`
- `language`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`

Additional metadata may include fields such as difficulty, tags, version, and author.

### `statement.md`

The Markdown problem statement shown in the extension’s problem detail view.

### `starter.py`

The starter file that the extension materializes into `.oj/problems/<problemId>.py`. This file should contain the function shape the student is expected to implement.

### `public.json`

Visible test cases. These are suitable for examples and transparent checks.

### `hidden.json`

Judge-only test cases. These are imported and executed by the worker, but they must never be exposed to student-facing APIs or UI surfaces.

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

## Example Test Payload

Both `public.json` and `hidden.json` are JSON arrays of test cases. A simplified shape is:

```json
[
  { "input": 12321, "expected": 12321 },
  { "input": -1111222232222111, "expected": -12321 }
]
```

The importer validates the layout and persists the statement, starter code, metadata, and tests into Postgres.

## Import Expectations

The importer expects the problem folder to be complete:

1. read `manifest.json`
2. load `statement.md`
3. load `starter.py`
4. parse `public.json`
5. parse `hidden.json`
6. compute content/version data
7. persist the assets and tests into Postgres

## Authoring Guidelines

- Keep `entryFunction` aligned with the function expected in `starter.py`.
- Keep `statement.md` student-facing and free of hidden test content.
- Use `hidden.json` for judge-only coverage.
- Keep the problem self-contained so it can be imported without manual database edits.
