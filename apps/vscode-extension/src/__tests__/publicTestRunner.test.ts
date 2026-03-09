import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalPublicTests } from '../practice/PublicTestRunner';

test('local public test runner executes manifest public tests without relying on doctest', () => {
  const result = runLocalPublicTests(
    [
      'def collapse(number):',
      '    if number == 0:',
      '        return 0',
      '    sign = -1 if number < 0 else 1',
      '    digits = str(abs(number))',
      '    collapsed = [digits[0]]',
      '    for digit in digits[1:]:',
      '        if digit != collapsed[-1]:',
      '            collapsed.append(digit)',
      '    return sign * int("".join(collapsed))',
      '',
      'if __name__ == "__main__":',
      '    import doctest',
      '    doctest.testmod()'
    ].join('\n'),
    'collapse',
    [
      { input: 0, output: 0 },
      { input: 112233, output: 123 },
      { input: -1111222232222111, output: -12321 }
    ]
  );

  assert.deepEqual(result, {
    total: 3,
    failures: []
  });
});

test('local public test runner reports mismatched manifest public tests', () => {
  const result = runLocalPublicTests(
    'def collapse(number):\n    return number\n',
    'collapse',
    [{ input: 112233, output: 123 }]
  );

  assert.equal(result.total, 1);
  assert.deepEqual(result.failures, [
    {
      caseIndex: 1,
      input: 112233,
      expected: 123,
      actual: 112233
    }
  ]);
});
