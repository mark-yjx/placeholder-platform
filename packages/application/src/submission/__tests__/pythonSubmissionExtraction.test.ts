import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPythonSubmission } from '../PythonSubmissionExtraction';

test('solve takes precedence over configured entryFunction', () => {
  const extracted = extractPythonSubmission({
    entryFunction: 'collapse',
    sourceCode: `
def collapse(value):
    return value - 1

def solve():
    return collapse(3)
`.trim()
  });

  assert.equal(extracted.selectedEntrypoint, 'solve');
  assert.match(extracted.extractedSourceCode, /^def collapse\(value\):$/m);
  assert.match(extracted.extractedSourceCode, /^def solve\(\):$/m);
});

test('configured entryFunction is used when solve is absent', () => {
  const extracted = extractPythonSubmission({
    entryFunction: 'collapse',
    sourceCode: `
def helper(value):
    return value.strip()

def collapse(value):
    return helper(value)
`.trim()
  });

  assert.equal(extracted.selectedEntrypoint, 'collapse');
  assert.match(extracted.extractedSourceCode, /^def helper\(value\):$/m);
  assert.match(extracted.extractedSourceCode, /^def collapse\(value\):$/m);
});

test('same-level helper functions are included when referenced by the selected entrypoint', () => {
  const extracted = extractPythonSubmission({
    entryFunction: 'collapse',
    sourceCode: `
def second(value):
    return value + "!"

def helper(value):
    return second(value)

def collapse(value):
    return helper(value)

def unused(value):
    return value
`.trim()
  });

  assert.match(extracted.extractedSourceCode, /^def second\(value\):$/m);
  assert.match(extracted.extractedSourceCode, /^def helper\(value\):$/m);
  assert.match(extracted.extractedSourceCode, /^def collapse\(value\):$/m);
  assert.doesNotMatch(extracted.extractedSourceCode, /^def unused\(value\):$/m);
});

test('best-effort extraction excludes malicious extra top-level code and __main__ blocks', () => {
  const extracted = extractPythonSubmission({
    entryFunction: 'collapse',
    sourceCode: `
import math
import os

OFFSET = 1

def helper(value):
    return value + OFFSET + math.floor(0.9)

def collapse(value):
    return helper(value)

print("steal data")
open("/etc/passwd").read()

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim()
  });

  assert.match(extracted.extractedSourceCode, /^import math$/m);
  assert.doesNotMatch(extracted.extractedSourceCode, /^import os$/m);
  assert.match(extracted.extractedSourceCode, /^OFFSET = 1$/m);
  assert.match(extracted.extractedSourceCode, /^def helper\(value\):$/m);
  assert.match(extracted.extractedSourceCode, /^def collapse\(value\):$/m);
  assert.doesNotMatch(extracted.extractedSourceCode, /print\("steal data"\)/);
  assert.doesNotMatch(extracted.extractedSourceCode, /open\("\/etc\/passwd"\)/);
  assert.doesNotMatch(extracted.extractedSourceCode, /__name__\s*==\s*["']__main__["']/);
  assert.doesNotMatch(extracted.extractedSourceCode, /doctest/);
});
