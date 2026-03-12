# Maximum Depth of Binary Tree

A binary tree is given as a level-order array that uses `null` for missing children.
Return the number of nodes on the longest path from the root to any leaf.

## Input Format

- A level-order array representation of a binary tree.
- Use `null` to mark a missing child.
- An empty array represents an empty tree.

## Output Format

- Return a single integer: the tree's maximum depth.

## Examples

### Example 1

Input:
```json
[3, 9, 20, null, null, 15, 7]
```

Output:
```json
3
```

### Example 2

Input:
```json
[1, null, 2]
```

Output:
```json
2
```

## Constraints

- The tree contains between `0` and `10^4` nodes.
- Each node value is between `-100` and `100`.

## Notes

- The root is at position 0 of the level-order array.
