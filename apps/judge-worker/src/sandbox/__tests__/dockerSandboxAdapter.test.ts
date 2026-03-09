import test from 'node:test';
import assert from 'node:assert/strict';

import { DockerSandboxAdapter } from '../DockerSandboxAdapter';

test('docker sandbox command enforces network-disabled and isolation flags', async () => {
  const calls: Array<{ command: string; args: readonly string[]; stdin: string }> = [];

  const adapter = new DockerSandboxAdapter(async (command) => {
    calls.push(command);
    return { stdout: 'ok', stderr: '' };
  });

  await adapter.execute({
    image: 'python:3.12-alpine',
    limits: { cpuCores: 1, memoryMb: 256, timeMs: 2000 },
    sourceCode: 'print("hello")'
  });

  assert.equal(calls.length, 1);
  const run = calls[0];
  assert.equal(run.command, 'docker');
  assert.deepEqual(run.args.slice(0, 4), ['run', '--rm', '-i', '--cpus']);
  assert.equal(run.args.includes('1'), true);
  assert.equal(run.args.includes('--memory'), true);
  assert.equal(run.args.includes('256m'), true);
  assert.equal(run.args.includes('--network'), true);
  assert.equal(run.args.includes('none'), true);
  assert.equal(run.args.includes('--read-only'), true);
  assert.equal(run.args.includes('--cap-drop=ALL'), true);
  assert.equal(run.args.includes('--security-opt'), true);
  assert.equal(run.args.includes('no-new-privileges'), true);
  assert.equal(run.args.includes('--tmpfs'), true);
  assert.equal(run.stdin, 'print("hello")');
});

test('docker sandbox execution leaves memory undefined when the executor does not report it', async () => {
  const adapter = new DockerSandboxAdapter(async () => ({
    stdout: 'ok',
    stderr: '',
    exitCode: 0,
    timeMs: 37
  }));

  const execution = await adapter.execute({
    image: 'python:3.12-alpine',
    limits: { cpuCores: 1, memoryMb: 256, timeMs: 2000 },
    sourceCode: 'print("hello")'
  });

  assert.deepEqual(execution, {
    stdout: 'ok',
    stderr: '',
    exitCode: 0,
    timeMs: 37,
    memoryKb: undefined
  });
});

test('docker sandbox execution extracts measured memory from sandbox stderr metadata', async () => {
  const adapter = new DockerSandboxAdapter(async () => ({
    stdout: 'ok',
    stderr: '__OJ_MEMORY_KB__=4096\n',
    exitCode: 0,
    timeMs: 41
  }));

  const execution = await adapter.execute({
    image: 'python:3.12-alpine',
    limits: { cpuCores: 1, memoryMb: 256, timeMs: 2000 },
    sourceCode: 'print("hello")'
  });

  assert.deepEqual(execution, {
    stdout: 'ok',
    stderr: '',
    exitCode: 0,
    timeMs: 41,
    memoryKb: 4096
  });
});
