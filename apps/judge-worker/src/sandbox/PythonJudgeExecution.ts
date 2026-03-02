import { RunnerRegistry } from '../runner/RunnerRegistry';
import { DockerSandboxAdapter } from './DockerSandboxAdapter';
import { ResourceLimits } from './judgePolicy';
import { buildRunnableJudgedPythonSource } from './PythonSubmissionExtractor';
import { ProblemJudgeTestCase } from './problemConfig';

export type PythonJudgeVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

export type PythonJudgeExecutionInput = {
  sandbox: DockerSandboxAdapter;
  runners: RunnerRegistry;
  image: string;
  sourceCode: string;
  entryFunction?: string;
  tests: readonly ProblemJudgeTestCase[];
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
  if (input.tests.length === 0) {
    return {
      status: 'finished',
      verdict: 'CE',
      timeMs: 0,
      memoryKb: 0
    };
  }
  let totalTimeMs = 0;
  let maxMemoryKb = 0;

  for (const testCase of input.tests) {
    let judgedSourceCode: string;
    try {
      judgedSourceCode = buildRunnableJudgedPythonSource(
        input.sourceCode,
        input.entryFunction ?? 'solve',
        testCase.input
      );
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
    totalTimeMs += execution.timeMs;
    maxMemoryKb = Math.max(maxMemoryKb, execution.memoryKb);

    if (execution.exitCode !== 0 || execution.stderr.trim().length > 0) {
      return {
        status: 'finished',
        verdict: 'RE',
        timeMs: totalTimeMs,
        memoryKb: maxMemoryKb
      };
    }

    const expectedStdout = `${JSON.stringify(testCase.expected)}\n`;
    if (execution.stdout !== expectedStdout) {
      return {
        status: 'finished',
        verdict: 'WA',
        timeMs: totalTimeMs,
        memoryKb: maxMemoryKb
      };
    }
  }

  return {
    status: 'finished',
    verdict: 'AC',
    timeMs: totalTimeMs,
    memoryKb: maxMemoryKb
  };
}
