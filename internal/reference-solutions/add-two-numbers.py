def add_two_numbers(data):
    l1 = data["l1"]
    l2 = data["l2"]
    result = []
    carry = 0
    index = 0

    while index < len(l1) or index < len(l2) or carry:
        total = carry
        if index < len(l1):
            total += l1[index]
        if index < len(l2):
            total += l2[index]

        result.append(total % 10)
        carry = total // 10
        index += 1

    return result
