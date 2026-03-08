import { ProblemDetail } from '../api/PracticeApiClient';

export type ProblemDetailWebviewActions = {
  openStarterFile(problemId: string): Promise<void>;
  submitCurrentFile(): Promise<void>;
  refreshProblem(problemId: string): Promise<void>;
};

export type ProblemDetailMessage =
  | { command: 'openStarter' }
  | { command: 'submitCurrentFile' }
  | { command: 'refreshProblem' };

export function isProblemDetailMessage(message: unknown): message is ProblemDetailMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }
  const command = (message as { command?: unknown }).command;
  return command === 'openStarter' || command === 'submitCurrentFile' || command === 'refreshProblem';
}

export async function handleProblemDetailMessage(
  message: unknown,
  currentProblem: ProblemDetail | null,
  actions: ProblemDetailWebviewActions
): Promise<void> {
  if (!isProblemDetailMessage(message)) {
    return;
  }

  const problemId = currentProblem?.problemId;
  if (!problemId) {
    return;
  }

  if (message.command === 'openStarter') {
    await actions.openStarterFile(problemId);
    return;
  }

  if (message.command === 'submitCurrentFile') {
    await actions.submitCurrentFile();
    return;
  }

  if (message.command === 'refreshProblem') {
    await actions.refreshProblem(problemId);
  }
}
