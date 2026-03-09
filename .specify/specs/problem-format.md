## Problem Format

### Canonical Problem Folder Structure
Each problem shall live under:

```text
problems/<problemId>/
  manifest.json
  statement.md
  starter.py
  hidden.json
```

### `manifest.json` Minimum Fields
Each problem must define at least:

- `problemId`
- `title`
- `entryFunction` (for example: `"collapse"`)
- `language` with value `"python"`
- `visibility` with value `"public"` or `"private"`
- `publicTests`

The following fields are optional and may fall back to system defaults when omitted:

- `timeLimitMs`
- `memoryLimitKb`

### File Roles
- `statement.md` contains the student-facing problem statement.
- `starter.py` contains the student-facing starter code template.
- `manifest.json` contains problem metadata and student-visible public tests.
- `hidden.json` contains hidden judge-only tests.

### Starter Code Rule
Student-facing `starter.py` must not include doctest examples, embedded tests, or a `__main__` block that runs doctest.
