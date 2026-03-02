import test from 'node:test';
import assert from 'node:assert/strict';
import { PythonRunnerPlugin } from '../../runner/PythonRunnerPlugin';
import { RunnerRegistry } from '../../runner/RunnerRegistry';
import { DockerSandboxAdapter } from '../DockerSandboxAdapter';
import { runPythonJudgeExecution } from '../PythonJudgeExecution';

function createRegistry(): RunnerRegistry {
  return new RunnerRegistry([new PythonRunnerPlugin()]);
}

test('correct Python code results in finished with verdict AC and recorded time/memory', async () => {
  const sandbox = new DockerSandboxAdapter(async () => ({
    stdout: '42\n',
    stderr: '',
    exitCode: 0,
    timeMs: 123,
    memoryKb: 2048
  }));

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: 'def solve(value):\n    return 42\n',
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'AC',
    timeMs: 123,
    memoryKb: 2048
  });
});

test('submission without solve but with configured entryFunction results in finished with verdict AC', async () => {
  const sandbox = new DockerSandboxAdapter(async (command) => ({
    stdout: '42\n',
    stderr: '',
    exitCode: 0,
    timeMs: 118,
    memoryKb: 2040
  }));

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: `
def helper():
    return 42

def collapse(value):
    return helper()
`.trim(),
    entryFunction: 'collapse',
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'AC',
    timeMs: 118,
    memoryKb: 2040
  });
});

test('wrong output results in finished with verdict WA and recorded time/memory', async () => {
  const sandbox = new DockerSandboxAdapter(async () => ({
    stdout: '41\n',
    stderr: '',
    exitCode: 0,
    timeMs: 140,
    memoryKb: 2052
  }));

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: 'def solve(value):\n    return 41\n',
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'WA',
    timeMs: 140,
    memoryKb: 2052
  });
});

test('runtime exception results in finished with verdict RE and recorded time/memory', async () => {
  const sandbox = new DockerSandboxAdapter(async () => ({
    stdout: '',
    stderr: 'Traceback (most recent call last): boom',
    exitCode: 1,
    timeMs: 90,
    memoryKb: 1900
  }));

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: 'def solve(value):\n    raise RuntimeError("boom")\n',
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'RE',
    timeMs: 90,
    memoryKb: 1900
  });
});

test('python judge execution runs through network-disabled sandbox command', async () => {
  const calls: Array<{ command: string; args: readonly string[]; stdin: string }> = [];
  const sandbox = new DockerSandboxAdapter(async (command) => {
    calls.push(command);
    return {
      stdout: '42\n',
      stderr: '',
      exitCode: 0,
      timeMs: 100,
      memoryKb: 2048
    };
  });

  await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: `
import math

VALUE = 40

def helper():
    return VALUE + math.floor(2.9)

def solve(value):
    return helper()

def unused():
    return "ignore"

print("debug")

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim(),
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.args.includes('--network'), true);
  assert.equal(calls[0]?.args.includes('none'), true);
  assert.deepEqual(calls[0]?.args.slice(-2), ['python', '/sandbox/main.py']);
  assert.match(calls[0]?.stdin ?? '', /^import math$/m);
  assert.match(calls[0]?.stdin ?? '', /^VALUE = 40$/m);
  assert.match(calls[0]?.stdin ?? '', /^def helper\(\):$/m);
  assert.match(calls[0]?.stdin ?? '', /^def solve\(value\):$/m);
  assert.doesNotMatch(calls[0]?.stdin ?? '', /^def unused\(\):$/m);
  assert.doesNotMatch(calls[0]?.stdin ?? '', /print\("debug"\)/);
  assert.doesNotMatch(calls[0]?.stdin ?? '', /doctest/);
  assert.match(calls[0]?.stdin ?? '', /^if __name__ == "__main__":$/m);
});

test('missing solve and missing configured entryFunction result in CE without invoking the sandbox', async () => {
  let called = false;
  const sandbox = new DockerSandboxAdapter(async () => {
    called = true;
    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
      timeMs: 100,
      memoryKb: 100
    };
  });

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: 'def helper():\n    return 42\n',
    tests: [{ testType: 'public', position: 1, input: null, expected: 42 }]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'CE',
    timeMs: 0,
    memoryKb: 0
  });
  assert.equal(called, false);
});

test('submission passing public tests but failing hidden tests returns WA without hidden detail leakage', async () => {
  let callCount = 0;
  const sandbox = new DockerSandboxAdapter(async () => {
    callCount += 1;
    return {
      stdout: callCount === 1 ? '12321\n' : '1000\n',
      stderr: '',
      exitCode: 0,
      timeMs: 30,
      memoryKb: 1024
    };
  });

  const result = await runPythonJudgeExecution({
    sandbox,
    runners: createRegistry(),
    image: 'python:3.12-alpine',
    sourceCode: 'def collapse(value):\n    return value\n',
    entryFunction: 'collapse',
    tests: [
      { testType: 'public', position: 1, input: 12321, expected: 12321 },
      { testType: 'hidden', position: 1, input: 1000000000000000000001n.toString(), expected: 101 }
    ]
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'WA',
    timeMs: 60,
    memoryKb: 1024
  });
  assert.equal('input' in result, false);
  assert.equal('expected' in result, false);
});
