import { RunnerPlugin, RunnerResolution } from './RunnerPlugin';

export class PythonRunnerPlugin implements RunnerPlugin {
  readonly language = 'python';

  resolve(): RunnerResolution {
    return {
      language: this.language,
      runArgs: ['python', '/sandbox/main.py']
    };
  }
}
