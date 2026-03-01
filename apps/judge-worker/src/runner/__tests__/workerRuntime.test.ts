import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

function resolveRepoRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '..', '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'judge-worker', 'src'))) {
      return candidate;
    }
  }
  throw new Error('Unable to resolve repository root for worker runtime tests');
}

function registerTsHook(): void {
  const existing = require.extensions['.ts'];
  if (!existing) {
    require.extensions['.ts'] = function registerTs(module, filename) {
      const source = fs.readFileSync(filename, 'utf8');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true
        },
        fileName: filename
      });

      (module as NodeModule & { _compile: (code: string, fileName: string) => void })._compile(
        transpiled.outputText,
        filename
      );
    };
  }

  const moduleWithResolve = Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) => string;
  };

  if (!(globalThis as { __worker_runtime_aliases_installed__?: boolean }).__worker_runtime_aliases_installed__) {
    const repoRoot = resolveRepoRoot();
    const resolver = moduleWithResolve._resolveFilename.bind(moduleWithResolve);
    moduleWithResolve._resolveFilename = function resolveWithAliases(
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) {
      if (request === '@packages/infrastructure/src') {
        return resolver(
          path.join(repoRoot, 'packages', 'infrastructure', 'src', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      if (request === '@packages/domain/src/judge') {
        return resolver(
          path.join(repoRoot, 'packages', 'domain', 'src', 'judge', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      if (request === '@packages/domain/src/submission') {
        return resolver(
          path.join(repoRoot, 'packages', 'domain', 'src', 'submission', 'index.ts'),
          parent,
          isMain,
          options
        );
      }
      return resolver(request, parent, isMain, options);
    };
    (globalThis as { __worker_runtime_aliases_installed__?: boolean }).__worker_runtime_aliases_installed__ = true;
  }
}

function loadWorkerRuntime() {
  registerTsHook();
  return require(path.join(
    resolveRepoRoot(),
    'apps',
    'judge-worker',
    'src',
    'workerRuntime.ts'
  )) as typeof import('../../workerRuntime');
}

test('worker runtime starts, idles with ticks, and stops cleanly', async () => {
  const { startWorkerRuntime } = loadWorkerRuntime();
  let ticks = 0;
  const logs: string[] = [];

  const runtime = startWorkerRuntime({
    pollIntervalMs: 5,
    onTick: async () => {
      ticks += 1;
    },
    logger: {
      info: (message) => logs.push(message),
      error: (message) => logs.push(message)
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  await runtime.stop();

  assert.ok(ticks > 0);
  assert.ok(logs.includes('worker.runtime.started'));
  assert.ok(logs.includes('worker.runtime.stopped'));
});
