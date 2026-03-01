import { RunnerRegistry } from '../runner/RunnerRegistry';
import { DockerSandboxAdapter } from './DockerSandboxAdapter';
import { ResourceLimits } from './judgePolicy';

export type PythonJudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

export type PythonJudgeExecutionInput = {
  sandbox: DockerSandboxAdapter;
  runners: RunnerRegistry;
  image: string;
  sourceCode: string;
  expectedStdout: string;
  limits?: ResourceLimits;
};

export type PythonJudgeExecutionResult = {
  status: 'finished';
  verdict: PythonJudgeVerdict;
  timeMs: number;
  memoryKb: number;
};

export async function runPythonJudgeExecution(
  input: PythonJudgeExecutionInput
): Promise<PythonJudgeExecutionResult> {
  const runner = input.runners.resolve('python').resolve();
  const limits = input.limits ?? { cpuCores: 1, memoryMb: 128, timeMs: 2000 };
  const execution = await input.sandbox.execute({
    image: input.image,
    limits,
    sourceCode: input.sourceCode,
    runArgs: runner.runArgs
  });

  let verdict: PythonJudgeVerdict = 'WA';
  if (execution.exitCode !== 0 || execution.stderr.trim().length > 0) {
    verdict = 'RE';
  } else if (execution.stdout === input.expectedStdout) {
    verdict = 'AC';
  }

  return {
    status: 'finished',
    verdict,
    timeMs: execution.timeMs,
    memoryKb: execution.memoryKb
  };
}
