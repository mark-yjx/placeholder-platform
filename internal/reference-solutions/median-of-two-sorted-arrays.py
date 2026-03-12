def find_median_sorted_arrays(data):
    nums1 = data["nums1"]
    nums2 = data["nums2"]

    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1

    total_length = len(nums1) + len(nums2)
    half = total_length // 2
    left = 0
    right = len(nums1)

    while True:
        partition1 = (left + right) // 2
        partition2 = half - partition1

        left1 = nums1[partition1 - 1] if partition1 > 0 else float("-inf")
        right1 = nums1[partition1] if partition1 < len(nums1) else float("inf")
        left2 = nums2[partition2 - 1] if partition2 > 0 else float("-inf")
        right2 = nums2[partition2] if partition2 < len(nums2) else float("inf")

        if left1 <= right2 and left2 <= right1:
            if total_length % 2 == 1:
                return float(min(right1, right2))
            return (max(left1, left2) + min(right1, right2)) / 2.0

        if left1 > right2:
            right = partition1 - 1
        else:
            left = partition1 + 1
