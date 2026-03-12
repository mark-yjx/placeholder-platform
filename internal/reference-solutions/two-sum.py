def two_sum(data):
    nums = data["nums"]
    target = data["target"]
    seen = {}

    for index, value in enumerate(nums):
        needed = target - value
        if needed in seen:
            return [seen[needed], index]
        seen[value] = index

    raise ValueError("input does not contain a valid pair")
