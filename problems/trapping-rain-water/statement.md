# Trapping Rain Water

The array `height` describes an elevation map, where each bar has width 1.
Compute how much water can be trapped between the bars after rain.

## Input Format

- A single array `height` of non-negative integers.

## Output Format

- Return one integer: the total trapped water.

## Examples

### Example 1

Input:
```json
[
  0,
  1,
  0,
  2,
  1,
  0,
  1,
  3,
  2,
  1,
  2,
  1
]
```

Output:
```json
6
```

### Example 2

Input:
```json
[
  4,
  2,
  0,
  3,
  2,
  5
]
```

Output:
```json
9
```

## Constraints

- `1 <= len(height) <= 2 * 10^4`
- `0 <= height[i] <= 10^5`

## Notes

- Water above a position is limited by the tallest bar to its left and right.
