import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  buildRunnableJudgedPythonSource,
  extractJudgedPythonSource
} from '../PythonSubmissionExtractor';

function resolvePythonCommand(): string | null {
  for (const candidate of ['python3', 'python']) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

test('extractor keeps solve, required helpers, imports, and referenced constants only', () => {
  const source = `
import math
import random

OFFSET = 7
UNUSED_CONSTANT = 11

def helper(value):
    return value + OFFSET

def solve():
    return helper(math.floor(3.8))

def unused():
    return random.randint(1, UNUSED_CONSTANT)

print("debug")

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim();

  const extracted = extractJudgedPythonSource(source);

  assert.match(extracted, /^import math/m);
  assert.doesNotMatch(extracted, /^import random/m);
  assert.match(extracted, /^OFFSET = 7$/m);
  assert.doesNotMatch(extracted, /^UNUSED_CONSTANT = 11$/m);
  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def solve\(\):$/m);
  assert.doesNotMatch(extracted, /^def unused\(\):$/m);
  assert.doesNotMatch(extracted, /__name__\s*==\s*["']__main__["']/);
  assert.doesNotMatch(extracted, /doctest/);
  assert.doesNotMatch(extracted, /print\("debug"\)/);
});

test('extractor resolves helper dependencies transitively', () => {
  const source = `
def leaf(value):
    return value + 1

def helper(value):
    return leaf(value) * 2

def solve():
    return helper(4)

def unused():
    return 0
`.trim();

  const extracted = extractJudgedPythonSource(source);

  assert.match(extracted, /^def leaf\(value\):$/m);
  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def solve\(\):$/m);
  assert.doesNotMatch(extracted, /^def unused\(\):$/m);
});

test('extractor can use configured entryFunction when solve is absent', () => {
  const extracted = extractJudgedPythonSource(
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
});

test('extracted code is importable and solve can be called without running doctest or top-level debug code', async (t) => {
  const python = resolvePythonCommand();
  if (!python) {
    t.skip('Python interpreter unavailable');
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oj-python-extract-'));
  const modulePath = path.join(tempDir, 'submission_module.py');

  const extracted = extractJudgedPythonSource(`
import math

DEBUG_VALUE = 3

def helper(value):
    return value + DEBUG_VALUE

def solve():
    return helper(math.floor(2.2))

def unused():
    return "unused"

print("debug should not run")

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim());

  await fs.writeFile(modulePath, extracted, 'utf8');

  const result = spawnSync(
    python,
    [
      '-c',
      `
import importlib.util
spec = importlib.util.spec_from_file_location("submission_module", r"${modulePath}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(module.solve())
`.trim()
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '5\n');
  assert.equal(result.stderr, '');
});

test('runnable judged source appends an execution harness around extracted solve', () => {
  const runnable = buildRunnableJudgedPythonSource(`
def solve():
    return 42
`.trim());

  assert.match(runnable, /^def solve\(\):$/m);
  assert.match(runnable, /^if __name__ == "__main__":$/m);
  assert.match(runnable, /__oj_result = solve\(\)/);
});

test('runnable judged source calls configured entryFunction when solve is absent', () => {
  const runnable = buildRunnableJudgedPythonSource(
    `
def collapse():
    return 42
`.trim(),
    'collapse'
  );

  assert.match(runnable, /^def collapse\(\):$/m);
  assert.match(runnable, /__oj_result = collapse\(\)/);
});
