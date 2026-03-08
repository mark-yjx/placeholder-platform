import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSubmitPayload } from '../submission/SubmissionPayloadExtraction';

test('extract submit payload uses configured entryFunction and rejects when absent', () => {
  const extracted = extractSubmitPayload(
    `
def helper(value):
    return value + 1

def collapse(value):
    return helper(value)
`.trim(),
    'collapse'
  );

  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def collapse\(value\):$/m);
  assert.throws(
    () =>
      extractSubmitPayload(
        `
def solve(value):
    return value
`.trim(),
        'collapse'
      ),
    /Submission must define a top-level collapse\(\) function/
  );
});

test('extract submit payload includes same-level helper closure for configured entryFunction', () => {
  const extracted = extractSubmitPayload(
    `
import math
import random
OFFSET = 2
UNUSED = 7

def normalize(value):
    return value + OFFSET

def collapse(value):
    return normalize(math.floor(value))

def unused_helper(value):
    return random.randint(0, UNUSED) + value
`.trim(),
    'collapse'
  );

  assert.match(extracted, /^import math$/m);
  assert.doesNotMatch(extracted, /^import random$/m);
  assert.match(extracted, /^OFFSET = 2$/m);
  assert.doesNotMatch(extracted, /^UNUSED = 7$/m);
  assert.match(extracted, /^def normalize\(value\):$/m);
  assert.match(extracted, /^def collapse\(value\):$/m);
  assert.doesNotMatch(extracted, /^def unused_helper\(value\):$/m);
});

test('extract submit payload excludes doctest and __main__ blocks for configured entryFunction', () => {
  const extracted = extractSubmitPayload(
    `
def collapse(value):
    """
    >>> collapse(3)
    3
    """
    return value

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim(),
    'collapse'
  );

  assert.match(extracted, /^def collapse\(value\):$/m);
  assert.doesNotMatch(extracted, />>> collapse\(3\)/);
  assert.doesNotMatch(extracted, /__name__\s*==\s*["']__main__["']/);
  assert.doesNotMatch(extracted, /doctest/);
});
