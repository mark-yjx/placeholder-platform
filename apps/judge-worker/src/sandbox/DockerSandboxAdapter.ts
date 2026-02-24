import { CONTAINER_SECURITY_FLAGS } from './containerPolicy';

type RunCommand = {
  command: string;
  args: readonly string[];
  stdin: string;
};

export type DockerSandboxInput = {
  image: string;
  sourceCode: string;
  runArgs?: readonly string[];
};

export type CommandExecutor = (command: RunCommand) => Promise<{ stdout: string; stderr: string }>;

export class DockerSandboxAdapter {
  constructor(private readonly executeCommand: CommandExecutor) {}

  buildRunCommand(input: DockerSandboxInput): RunCommand {
    return {
      command: 'docker',
      args: [
        'run',
        '--rm',
        ...CONTAINER_SECURITY_FLAGS,
        input.image,
        ...(input.runArgs ?? ['python', '/sandbox/main.py'])
      ],
      stdin: input.sourceCode
    };
  }

  async execute(input: DockerSandboxInput): Promise<{ stdout: string; stderr: string }> {
    const command = this.buildRunCommand(input);
    return this.executeCommand(command);
  }
}
