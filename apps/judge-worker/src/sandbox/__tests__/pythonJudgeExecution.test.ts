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
    sourceCode: 'print(42)',
    expectedStdout: '42\n'
  });

  assert.deepEqual(result, {
    status: 'finished',
    verdict: 'AC',
    timeMs: 123,
    memoryKb: 2048
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
    sourceCode: 'print(41)',
    expectedStdout: '42\n'
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
    sourceCode: 'raise RuntimeError("boom")',
    expectedStdout: '42\n'
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
    sourceCode: 'print(42)',
    expectedStdout: '42\n'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.args.includes('--network'), true);
  assert.equal(calls[0]?.args.includes('none'), true);
  assert.deepEqual(calls[0]?.args.slice(-2), ['python', '/sandbox/main.py']);
});
