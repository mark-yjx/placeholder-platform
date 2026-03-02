def collapse(number):
    """
    >>> collapse(0)
    0
    >>> collapse(-0)
    0
    >>> collapse(9)
    9
    >>> collapse(-9)
    -9
    >>> collapse(12321)
    12321
    >>> collapse(-12321)
    -12321
    >>> collapse(-1111222232222111)
    -12321
    >>> collapse(1155523335551116111666)
    152351616
    >>> collapse(-900111212777394440300)
    -9012127394030
    """
    # YOUR CODE HERE
    number=str(number)
    solution=[number[0]]
    for i in number:
        if i!=solution[-1]:
            solution.append(i)
    return int(''.join(solution))


if __name__ == "__main__":
    import doctest
    doctest.testmod()
