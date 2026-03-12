def is_match(data):
    s = data["s"]
    p = data["p"]
    rows = len(s) + 1
    cols = len(p) + 1
    dp = [[False] * cols for _ in range(rows)]
    dp[0][0] = True

    for col in range(2, cols):
        if p[col - 1] == "*":
            dp[0][col] = dp[0][col - 2]

    for row in range(1, rows):
        for col in range(1, cols):
            current = p[col - 1]

            if current == "." or current == s[row - 1]:
                dp[row][col] = dp[row - 1][col - 1]
                continue

            if current != "*":
                continue

            dp[row][col] = dp[row][col - 2]
            previous = p[col - 2]
            if previous == "." or previous == s[row - 1]:
                dp[row][col] = dp[row][col] or dp[row - 1][col]

    return dp[-1][-1]
