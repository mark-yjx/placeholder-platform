def is_valid_parentheses(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []

    for char in s:
        if char in pairs.values():
            stack.append(char)
            continue

        if not stack or stack[-1] != pairs[char]:
            return False
        stack.pop()

    return not stack
