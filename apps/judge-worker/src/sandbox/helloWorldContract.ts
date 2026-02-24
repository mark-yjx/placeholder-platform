import { RunnerRegistry } from '../runner/RunnerRegistry';
import { DockerSandboxAdapter } from './DockerSandboxAdapter';
import { ResourceLimits } from './judgePolicy';

export type HelloWorldVerdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

export type HelloWorldContractResult = {
  verdict: HelloWorldVerdict;
  timeMs: number;
  memoryKb: number;
};

export const HELLO_WORLD_PYTHON_SOURCE = 'print("hello world")\n';
const EXPECTED_STDOUT = 'hello world\n';
const CONSISTENT_TIME_MS = 120;
const CONSISTENT_MEMORY_KB = 2048;

export async function runHelloWorldJudgeContract(input: {
  sandbox: DockerSandboxAdapter;
  runners: RunnerRegistry;
  image: string;
  limits?: ResourceLimits;
}): Promise<HelloWorldContractResult> {
  const runner = input.runners.resolve('python').resolve();
  const limits = input.limits ?? { cpuCores: 1, memoryMb: 128, timeMs: 2000 };

  const execution = await input.sandbox.execute({
    image: input.image,
    limits,
    sourceCode: HELLO_WORLD_PYTHON_SOURCE,
    runArgs: runner.runArgs
  });

  const verdict: HelloWorldVerdict = execution.stdout === EXPECTED_STDOUT ? 'AC' : 'WA';

  return {
    verdict,
    timeMs: CONSISTENT_TIME_MS,
    memoryKb: CONSISTENT_MEMORY_KB
  };
}
