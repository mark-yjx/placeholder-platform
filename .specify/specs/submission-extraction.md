## Submission Extraction

### Submission File Type
The student submission file shall be a `.py` file.

### Entrypoint Extraction Rules
Allowed submitted code is extracted using the following precedence:

1. If the file contains a top-level `def solve():`, use `solve()` as the entrypoint.
2. Otherwise, extract the top-level function whose name equals `problem.entryFunction`.

### Helper Function Rule
In addition to the selected entry function, the extraction step may include same-level helper functions:

- Only other top-level `def` functions are eligible.
- A helper function is allowed only if it is referenced by the entry function.
- A simple static name reference check is sufficient for this rule.

### Disallowed Behavior
The submission contract disallows:

- Importing local files
- Reading arbitrary filesystem paths
- Network calls

Network restrictions are enforced by the sandbox, but this rule must also be documented as part of the submission contract.

### Doctest and `__main__` Rules
- The judge shall not execute `__main__`.
- The judge shall not execute doctest.
- Doctest content exists only for student local self-test.

### Output Contract
The judge runs the extracted module and calls the selected entry function using the test harness, not `stdin`.
