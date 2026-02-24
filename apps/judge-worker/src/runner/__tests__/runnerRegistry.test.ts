import test from 'node:test';
import assert from 'node:assert/strict';

import { PythonRunnerPlugin, RunnerRegistry } from '../index';

test('runner registry resolves python via plugin registry', () => {
  const registry = new RunnerRegistry([new PythonRunnerPlugin()]);

  const resolution = registry.resolve('python').resolve();

  assert.equal(resolution.language, 'python');
  assert.deepEqual(resolution.runArgs, ['python', '/sandbox/main.py']);
});

test('runner registry rejects unsupported language cleanly', () => {
  const registry = new RunnerRegistry([new PythonRunnerPlugin()]);

  assert.throws(
    () => registry.resolve('javascript').resolve(),
    /Unsupported language: javascript/
  );
});
