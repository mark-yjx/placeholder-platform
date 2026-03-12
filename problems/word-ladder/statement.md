# Word Ladder

Transform `beginWord` into `endWord` by changing one letter at a time.
Every intermediate word must appear in `wordList`. Return the number of words in the shortest valid sequence, or `0` if no such sequence exists.

## Input Format

- A JSON object with `beginWord`, `endWord`, and `wordList`.
- All words use lowercase English letters and have the same length.

## Output Format

- Return the length of the shortest transformation sequence, counting both the start and end words.

## Examples

### Example 1

Input:
```json
{
  "beginWord": "hit",
  "endWord": "cog",
  "wordList": [
    "hot",
    "dot",
    "dog",
    "lot",
    "log",
    "cog"
  ]
}
```

Output:
```json
5
```

Explanation: One shortest sequence is `hit -> hot -> dot -> dog -> cog`.

### Example 2

Input:
```json
{
  "beginWord": "hit",
  "endWord": "cog",
  "wordList": [
    "hot",
    "dot",
    "dog",
    "lot",
    "log"
  ]
}
```

Output:
```json
0
```

## Constraints

- `1 <= len(beginWord) <= 10`
- `1 <= len(wordList) <= 5000`
- `beginWord != endWord`

## Notes

- Two words are adjacent when they differ in exactly one position.
