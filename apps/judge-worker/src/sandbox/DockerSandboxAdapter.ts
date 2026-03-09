import { CONTAINER_SECURITY_FLAGS } from './containerPolicy';
import { ResourceLimits } from './judgePolicy';

const MEMORY_METRIC_PREFIX = '__OJ_MEMORY_KB__=';

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

export type DockerSandboxCommandExecution = {
  stdout: string;
  stderr: string;
  exitCode?: number;
  timeMs?: number;
  memoryKb?: number;
};

export type DockerSandboxExecution = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  memoryKb?: number;
};

export type CommandExecutor = (command: RunCommand) => Promise<DockerSandboxCommandExecution>;

function extractMeasuredMemoryFromStderr(stderr: string): { stderr: string; memoryKb?: number } {
  if (!stderr.includes(MEMORY_METRIC_PREFIX)) {
    return { stderr };
  }

  const trailingNewline = stderr.endsWith('\n');
  let measuredMemoryKb: number | undefined;
  const filteredLines = stderr
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.startsWith(MEMORY_METRIC_PREFIX)) {
        return true;
      }

      const rawValue = line.slice(MEMORY_METRIC_PREFIX.length).trim();
      const parsedValue = Number(rawValue);
      if (Number.isInteger(parsedValue) && parsedValue >= 0) {
        measuredMemoryKb = parsedValue;
      }
      return false;
    });

  let sanitizedStderr = filteredLines.join('\n');
  if (trailingNewline && sanitizedStderr.length > 0) {
    sanitizedStderr += '\n';
  }

  return {
    stderr: sanitizedStderr,
    memoryKb: measuredMemoryKb
  };
}

export class DockerSandboxAdapter {
  constructor(private readonly executeCommand: CommandExecutor) {}

  buildRunCommand(input: DockerSandboxInput): RunCommand {
    return {
      command: 'docker',
      args: [
        'run',
        '--rm',
        '-i',
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

  async execute(input: DockerSandboxInput): Promise<DockerSandboxExecution> {
    const command = this.buildRunCommand(input);
    const startedAt = Date.now();
    const execution = await this.executeCommand(command);
    const parsedMetrics = extractMeasuredMemoryFromStderr(execution.stderr);
    return {
      stdout: execution.stdout,
      stderr: parsedMetrics.stderr,
      exitCode: execution.exitCode ?? 0,
      timeMs: execution.timeMs ?? Math.max(Date.now() - startedAt, 0),
      memoryKb: execution.memoryKb ?? parsedMetrics.memoryKb
    };
  }
}
