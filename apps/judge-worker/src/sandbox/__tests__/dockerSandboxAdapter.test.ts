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
  assert.deepEqual(run.args.slice(0, 3), ['run', '--rm', '--cpus']);
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
});
