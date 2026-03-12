def num_islands(grid):
    if not grid or not grid[0]:
        return 0

    rows = len(grid)
    cols = len(grid[0])
    seen = set()
    islands = 0

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != "1" or (row, col) in seen:
                continue

            islands += 1
            stack = [(row, col)]
            seen.add((row, col))

            while stack:
                current_row, current_col = stack.pop()
                for delta_row, delta_col in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    next_row = current_row + delta_row
                    next_col = current_col + delta_col
                    if not (0 <= next_row < rows and 0 <= next_col < cols):
                        continue
                    if grid[next_row][next_col] != "1" or (next_row, next_col) in seen:
                        continue
                    seen.add((next_row, next_col))
                    stack.append((next_row, next_col))

    return islands
