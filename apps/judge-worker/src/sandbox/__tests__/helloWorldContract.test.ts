import test from 'node:test';
import assert from 'node:assert/strict';

import { PythonRunnerPlugin } from '../../runner/PythonRunnerPlugin';
import { RunnerRegistry } from '../../runner/RunnerRegistry';
import { DockerSandboxAdapter } from '../DockerSandboxAdapter';
import { HELLO_WORLD_PYTHON_SOURCE, runHelloWorldJudgeContract } from '../helloWorldContract';

test('hello world contract returns consistent verdict + time + memory', async () => {
  const calls: Array<{ command: string; args: readonly string[]; stdin: string }> = [];
  const adapter = new DockerSandboxAdapter(async (command) => {
    calls.push(command);
    return { stdout: 'hello world\n', stderr: '' };
  });

  const registry = new RunnerRegistry([new PythonRunnerPlugin()]);

  const first = await runHelloWorldJudgeContract({
    sandbox: adapter,
    runners: registry,
    image: 'python:3.12-alpine'
  });
  const second = await runHelloWorldJudgeContract({
    sandbox: adapter,
    runners: registry,
    image: 'python:3.12-alpine'
  });

  assert.deepEqual(first, { verdict: 'AC', timeMs: 120, memoryKb: 2048 });
  assert.deepEqual(second, { verdict: 'AC', timeMs: 120, memoryKb: 2048 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.command, 'docker');
  assert.equal(calls[0]?.stdin, HELLO_WORLD_PYTHON_SOURCE);
  assert.deepEqual(calls[0]?.args.slice(-2), ['python', '/sandbox/main.py']);
});
