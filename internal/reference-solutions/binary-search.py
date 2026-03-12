def binary_search(data):
    nums = data["nums"]
    target = data["target"]
    left = 0
    right = len(nums) - 1

    while left <= right:
        middle = (left + right) // 2
        value = nums[middle]

        if value == target:
            return middle
        if value < target:
            left = middle + 1
        else:
            right = middle - 1

    return -1
