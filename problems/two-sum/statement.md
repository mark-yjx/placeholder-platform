# Two Sum

The input object contains an integer array `nums` and an integer `target`.
Find the only pair of distinct positions whose values add up to `target`, and return those two indices in increasing order.

## Input Format

- A JSON object with two fields: `nums` (an array of integers) and `target` (an integer).
- Exactly one valid answer exists.

## Output Format

- Return a two-element array `[i, j]` where `i < j` and `nums[i] + nums[j] == target`.

## Examples

### Example 1

Input:
```json
{
  "nums": [
    2,
    7,
    11,
    15
  ],
  "target": 9
}
```

Output:
```json
[
  0,
  1
]
```

Explanation: The values at indices 0 and 1 sum to 9.

### Example 2

Input:
```json
{
  "nums": [
    3,
    2,
    4
  ],
  "target": 6
}
```

Output:
```json
[
  1,
  2
]
```

## Constraints

- `2 <= len(nums) <= 10^4`
- `-10^9 <= nums[i] <= 10^9`
- `-10^9 <= target <= 10^9`

## Notes

- Returning the indices in increasing order removes output ambiguity in this judge.
