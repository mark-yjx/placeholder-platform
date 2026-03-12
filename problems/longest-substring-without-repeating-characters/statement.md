# Longest Substring Without Repeating Characters

Given a string `s`, find the longest contiguous substring that contains no duplicate characters.
Return only the length of that substring.

## Input Format

- A single string `s`. The string may contain letters, digits, symbols, and spaces.

## Output Format

- Return one integer: the maximum length of a duplicate-free substring.

## Examples

### Example 1

Input:
```json
"abcabcbb"
```

Output:
```json
3
```

Explanation: One valid longest substring is `abc`.

### Example 2

Input:
```json
"bbbbb"
```

Output:
```json
1
```

## Constraints

- `0 <= len(s) <= 5 * 10^4`

## Notes

- A substring must stay contiguous. Reordering characters is not allowed.
