import { RunnerRegistry } from '../runner/RunnerRegistry';
import { DockerSandboxAdapter } from './DockerSandboxAdapter';
import { ResourceLimits } from './judgePolicy';
import { buildRunnableJudgedPythonSource } from './PythonSubmissionExtractor';

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
  let judgedSourceCode: string;

  try {
    judgedSourceCode = buildRunnableJudgedPythonSource(input.sourceCode);
  } catch {
    return {
      status: 'finished',
      verdict: 'CE',
      timeMs: 0,
      memoryKb: 0
    };
  }

  const execution = await input.sandbox.execute({
    image: input.image,
    limits,
    sourceCode: judgedSourceCode,
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
