import { CONTAINER_SECURITY_FLAGS } from './containerPolicy';
import { ResourceLimits } from './judgePolicy';

type RunCommand = {
  command: string;
  args: readonly string[];
  stdin: string;
};

export type DockerSandboxInput = {
  image: string;
  sourceCode: string;
  limits: ResourceLimits;
  runArgs?: readonly string[];
};

export type DockerSandboxExecution = {
  stdout: string;
  stderr: string;
  exitCode?: number;
  timeMs?: number;
  memoryKb?: number;
};

export type CommandExecutor = (command: RunCommand) => Promise<DockerSandboxExecution>;

export class DockerSandboxAdapter {
  constructor(private readonly executeCommand: CommandExecutor) {}

  buildRunCommand(input: DockerSandboxInput): RunCommand {
    return {
      command: 'docker',
      args: [
        'run',
        '--rm',
        '--cpus',
        String(input.limits.cpuCores),
        '--memory',
        `${input.limits.memoryMb}m`,
        ...CONTAINER_SECURITY_FLAGS,
        input.image,
        ...(input.runArgs ?? ['python', '/sandbox/main.py'])
      ],
      stdin: input.sourceCode
    };
  }

  async execute(input: DockerSandboxInput): Promise<Required<DockerSandboxExecution>> {
    const command = this.buildRunCommand(input);
    const startedAt = Date.now();
    const execution = await this.executeCommand(command);
    return {
      stdout: execution.stdout,
      stderr: execution.stderr,
      exitCode: execution.exitCode ?? 0,
      timeMs: execution.timeMs ?? Math.max(Date.now() - startedAt, 0),
      memoryKb: execution.memoryKb ?? 0
    };
  }
}
