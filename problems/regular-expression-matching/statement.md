# Regular Expression Matching

Implement a matcher for patterns that support `.` and `*`.
A dot matches any single character, and `*` means zero or more copies of the immediately preceding element. The match must cover the entire string.

## Input Format

- A JSON object with `s` (the input string) and `p` (the pattern).
- The pattern uses lowercase letters, `.`, and `*`.

## Output Format

- Return `true` if `p` matches all of `s`, otherwise return `false`.

## Examples

### Example 1

Input:
```json
{
  "s": "aa",
  "p": "a"
}
```

Output:
```json
false
```

### Example 2

Input:
```json
{
  "s": "aa",
  "p": "a*"
}
```

Output:
```json
true
```

## Constraints

- `1 <= len(s) <= 20`
- `1 <= len(p) <= 20`
- Every `*` in `p` has a valid character before it.

## Notes

- `*` applies only to the single pattern element immediately before it.
