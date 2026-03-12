# Valid Parentheses

The input is a string made only of the bracket characters `()[]{}`.
Decide whether every opening bracket is closed by the same type of bracket and in the correct order.

## Input Format

- A single string `s` containing only the characters `(`, `)`, `[`, `]`, `{`, and `}`.

## Output Format

- Return `true` if the string is valid, otherwise return `false`.

## Examples

### Example 1

Input:
```json
"()"
```

Output:
```json
true
```

### Example 2

Input:
```json
"([)]"
```

Output:
```json
false
```

## Constraints

- `1 <= len(s) <= 10^4`

## Notes

- A closing bracket is invalid if there is no matching opener available at that position.
