# Number of Islands

The grid is made of the strings `"1"` (land) and `"0"` (water).
Count how many separate islands are formed when land cells connect horizontally or vertically.

## Input Format

- A 2D array of strings where each entry is either `"1"` or `"0"`.

## Output Format

- Return the number of islands in the grid.

## Examples

### Example 1

Input:
```json
[
  [
    "1",
    "1",
    "1",
    "1",
    "0"
  ],
  [
    "1",
    "1",
    "0",
    "1",
    "0"
  ],
  [
    "1",
    "1",
    "0",
    "0",
    "0"
  ],
  [
    "0",
    "0",
    "0",
    "0",
    "0"
  ]
]
```

Output:
```json
1
```

### Example 2

Input:
```json
[
  [
    "1",
    "1",
    "0",
    "0",
    "0"
  ],
  [
    "1",
    "1",
    "0",
    "0",
    "0"
  ],
  [
    "0",
    "0",
    "1",
    "0",
    "0"
  ],
  [
    "0",
    "0",
    "0",
    "1",
    "1"
  ]
]
```

Output:
```json
3
```

## Constraints

- `1 <= rows, cols <= 300`

## Notes

- Diagonal neighbors do not connect islands.
