from collections import deque


def max_depth(level_order):
    if not level_order or level_order[0] is None:
        return 0

    queue = deque([level_order[0]])
    index = 1
    depth = 0

    while queue:
        depth += 1
        for _ in range(len(queue)):
            queue.popleft()

            if index < len(level_order):
                left = level_order[index]
                index += 1
                if left is not None:
                    queue.append(left)

            if index < len(level_order):
                right = level_order[index]
                index += 1
                if right is not None:
                    queue.append(right)

    return depth
