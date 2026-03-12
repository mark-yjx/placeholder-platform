# Binary Search

The input object contains a sorted array `nums` with distinct integers and a `target` value.
Return the index of `target`, or `-1` if the value does not appear.

## Input Format

- A JSON object with `nums` (sorted in ascending order) and `target`.

## Output Format

- Return the index of `target` in `nums`, or `-1` if it is missing.

## Examples

### Example 1

Input:
```json
{
  "nums": [
    -1,
    0,
    3,
    5,
    9,
    12
  ],
  "target": 9
}
```

Output:
```json
4
```

### Example 2

Input:
```json
{
  "nums": [
    -1,
    0,
    3,
    5,
    9,
    12
  ],
  "target": 2
}
```

Output:
```json
-1
```

## Constraints

- `1 <= len(nums) <= 10^4`
- `-10^4 < nums[i], target < 10^4`
- `nums` contains distinct values and is sorted in ascending order.

## Notes

- An `O(log n)` solution is expected.
