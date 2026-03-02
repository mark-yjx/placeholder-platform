## Problem Format

### Canonical Problem Folder Structure
Each problem shall live under:

```text
data/problems/<slug>/
  statement.md
  starter.py
  problem.json
```

### `problem.json` Minimum Fields
Each problem must define at least:

- `slug`
- `title`
- `entryFunction` (for example: `"collapse"`)
- `language` with value `"python"`
- `visibility` with value `"public"` or `"private"`

The following fields are optional and may fall back to system defaults when omitted:

- `timeLimitMs`
- `memoryLimitKb`

### File Roles
- `statement.md` contains the student-facing problem statement.
- `starter.py` contains the student-facing starter code template.
- `problem.json` contains problem metadata used by authoring, publishing, and judging flows.

### Starter Code Rule
Student-facing `starter.py` may include doctest examples and a `__main__` block that runs doctest for local self-test.
