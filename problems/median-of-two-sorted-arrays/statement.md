# Median of Two Sorted Arrays

The input object provides two arrays that are already sorted in ascending order.
Compute the median of all values across both arrays without fully merging them in linear time.

## Input Format

- A JSON object with `nums1` and `nums2`, each a sorted array of integers.
- At least one array is non-empty.

## Output Format

- Return the median as a floating-point number.
- If the median is a whole number, return it with `.0`.

## Examples

### Example 1

Input:
```json
{
  "nums1": [
    1,
    3
  ],
  "nums2": [
    2
  ]
}
```

Output:
```json
2.0
```

### Example 2

Input:
```json
{
  "nums1": [
    1,
    2
  ],
  "nums2": [
    3,
    4
  ]
}
```

Output:
```json
2.5
```

## Constraints

- `0 <= len(nums1), len(nums2) <= 1000`
- `1 <= len(nums1) + len(nums2) <= 2000`
- `-10^6 <= value <= 10^6`

## Notes

- An `O(log (m + n))` approach is the intended target.
