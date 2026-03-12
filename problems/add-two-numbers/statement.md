# Add Two Numbers

Each input array represents a linked list written from head to tail, where every node stores one digit.
The digits are stored in reverse order, so `[2, 4, 3]` represents the number 342. Add the two numbers and return the sum in the same reversed format.

## Input Format

- A JSON object with `l1` and `l2`, each a non-empty array of digits between `0` and `9`.
- Neither list contains unnecessary leading zeros for the represented number.

## Output Format

- Return an array of digits that represents the sum, also in reverse order.

## Examples

### Example 1

Input:
```json
{
  "l1": [
    2,
    4,
    3
  ],
  "l2": [
    5,
    6,
    4
  ]
}
```

Output:
```json
[
  7,
  0,
  8
]
```

Explanation: `[2,4,3]` means 342 and `[5,6,4]` means 465, so the sum is 807.

### Example 2

Input:
```json
{
  "l1": [
    0
  ],
  "l2": [
    0
  ]
}
```

Output:
```json
[
  0
]
```

## Constraints

- `1 <= len(l1), len(l2) <= 100`
- Each digit is between `0` and `9`.

## Notes

- The output may be longer than both inputs if there is a final carry.
