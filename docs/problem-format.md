# Problem Format

Problems are authored in the repository and imported into Postgres through the problem importer. The canonical schema is file-based and does not use doctest as part of the contract.

Canonical problem folders live under `problems/<problemId>/`.

## Canonical Layout

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

`manifest.json` is the single source of truth for problem metadata and public test data.

Required fields:

- `problemId`
- `title`
- `language`
- `entryFunction`
- `timeLimitMs`
- `memoryLimitKb`
- `visibility`
- `examples`
- `publicTests`

Common optional metadata currently supported in repository content:

- `difficulty`
- `tags`
- `version`
- `author`

Field expectations:

- `problemId`: non-empty string
- `title`: non-empty string
- `language`: currently `"python"`
- `entryFunction`: non-empty valid Python identifier
- `timeLimitMs`: positive integer
- `memoryLimitKb`: positive integer
- `visibility`: repository content currently uses `"public"` or `"private"`
- `examples`: array of visible example cases
- `publicTests`: array of explicit public test cases

Case shape:

```json
{ "input": 111, "output": 1 }
```

Example manifest:

```json
{
  "problemId": "collapse",
  "title": "Collapse Identical Digits",
  "entryFunction": "collapse",
  "language": "python",
  "timeLimitMs": 2000,
  "memoryLimitKb": 65536,
  "visibility": "public",
  "examples": [
    { "input": 111, "output": 1 },
    { "input": 111122223333, "output": 123 }
  ],
  "publicTests": [
    { "input": 0, "output": 0 },
    { "input": 12321, "output": 12321 }
  ]
}
```

`examples` are for student-facing presentation. `publicTests` are the explicit public execution cases used by local student testing and the public part of judge execution.

## `statement.md`

`statement.md` contains only the human-readable problem statement.

It should contain:

- the problem description
- constraints
- clarifications for students

It should not contain:

- hidden tests
- judge-only fixtures
- runtime metadata
- doctest blocks used as test sources

Examples shown in the UI may come from the statement text, the manifest `examples` field, or both, but runtime discovery must not parse tests from the statement.

## `starter.py`

`starter.py` is starter code only.

It must:

- define the function named by `entryFunction`
- remain compatible with the explicit `entryFunction` contract
- contain no doctest
- contain no embedded tests
- contain only starter logic, docstrings, comments, and placeholders appropriate for students

Example:

```python
def collapse(number):
    """Collapse adjacent repeated digits while preserving sign."""
    # YOUR CODE HERE
    raise NotImplementedError
```

Important invariants:

- `starter.py` is not a test source
- there is no fixed global `solve()` assumption
- `entryFunction` is the canonical callable contract

## `hidden.json`

`hidden.json` stores hidden judge-only tests.

Shape:

```json
[
  { "input": 1111111111111, "output": 1 },
  { "input": -2222222222, "output": -2 }
]
```

Hidden tests:

- are imported into Postgres
- are executed by the judge worker
- affect final verdicts
- must never be exposed through student-facing APIs or the extension UI

## Public Tests And Hidden Tests

The canonical split is:

- public tests: `manifest.json.publicTests`
- hidden tests: `hidden.json`

There is no standalone `public.json` in the final schema, and doctest is not used for test discovery.

## Import Behavior

The importer reads each problem directory as:

1. `manifest.json`
2. `statement.md`
3. `starter.py`
4. `hidden.json`

It then:

- validates metadata and limits from `manifest.json`
- validates `examples`
- validates `publicTests`
- validates `hidden.json`
- computes a content digest
- persists the imported version into Postgres

The repository-managed import entrypoint is `tools/scripts/import-problems.mjs`.

## Authoring Guidelines

- keep `entryFunction` and `starter.py` aligned
- put visible example cases in `examples`
- put explicit public execution cases in `publicTests`
- put judge-only coverage in `hidden.json`
- keep `statement.md` student-facing
- keep `starter.py` free of doctest and embedded test scaffolding
- hidden tests remain judge-only and must never be exposed to students
