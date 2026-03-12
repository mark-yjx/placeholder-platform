from collections import defaultdict, deque


def ladder_length(data):
    begin_word = data["beginWord"]
    end_word = data["endWord"]
    words = set(data["wordList"])

    if end_word not in words:
        return 0

    words.add(begin_word)
    word_length = len(begin_word)
    patterns = defaultdict(list)

    for word in words:
        for index in range(word_length):
            pattern = f"{word[:index]}*{word[index + 1:]}"
            patterns[pattern].append(word)

    queue = deque([(begin_word, 1)])
    seen = {begin_word}

    while queue:
        word, distance = queue.popleft()
        if word == end_word:
            return distance

        for index in range(word_length):
            pattern = f"{word[:index]}*{word[index + 1:]}"
            for next_word in patterns[pattern]:
                if next_word in seen:
                    continue
                seen.add(next_word)
                queue.append((next_word, distance + 1))
            patterns[pattern] = []

    return 0
