import { EngagementCommands } from './engagement/EngagementCommands';
import { AuthCommands } from './auth/AuthCommands';
import { PracticeCommands } from './practice/PracticeCommands';
import { mapExtensionError } from './errors/ExtensionErrorMapper';
import { ProblemDetail, PublishedProblem, SubmissionResult } from './api/PracticeApiClient';
import { formatSubmissionDetail } from './ui/PracticeViewState';
import { ProblemStarterWorkspace } from './ui/ProblemStarterWorkspace';
import { extractSubmitPayload } from './submission/SubmissionPayloadExtraction';
import { LocalPracticeStateStore } from './runtime/LocalPracticeStateStore';
import { createLoginViewModel } from './auth/AuthViews';
import { resolveProblemStatementMarkdown } from './ui/PracticeViewState';

export type DisposableLike = { dispose: () => void };

export type RegisterCommand = (
  commandId: string,
  callback: (...args: unknown[]) => Promise<void>
) => DisposableLike;

export type OutputChannelLike = {
  appendLine: (value: string) => void;
};

export type WindowLike = {
  showErrorMessage: (message: string) => void;
  showInformationMessage: (message: string) => void;
  showWarningMessage?: <T extends string>(
    message: string,
    options: { modal: boolean },
    ...items: readonly T[]
  ) => Promise<T | undefined>;
  showQuickPick?: <T extends { label: string }>(
    items: readonly T[],
    options?: {
      placeHolder?: string;
      ignoreFocusOut?: boolean;
    }
  ) => Promise<T | undefined>;
  showInputBox: (options?: {
    prompt?: string;
    placeHolder?: string;
    value?: string;
    password?: boolean;
    ignoreFocusOut?: boolean;
  }) => Promise<string | undefined>;
  activeTextEditor?: {
    document: {
      getText: () => string;
      languageId: string;
      fileName?: string;
    };
  };
};

export type ExtensionCommandDependencies = {
  authCommands: AuthCommands;
  practiceCommands: PracticeCommands;
  engagementCommands: EngagementCommands;
  waitForNextPoll?: (delayMs: number) => Promise<void>;
  practiceViews?: {
    showProblems: (problems: readonly PublishedProblem[]) => void;
    showProblemDetail?: (problem: ProblemDetail) => void;
    showSubmissionCreated: (submissionId: string) => void;
    showSubmissionResult: (result: SubmissionResult) => void;
    revealSubmission: (submissionId: string) => void;
    revealProblem: (problemId: string) => Promise<void>;
    setSelectedProblem?: (problemId: string) => void;
    getSelectedProblemId?: () => string | null;
  };
  problemStarterWorkspace?: ProblemStarterWorkspace;
  localStateStore?: LocalPracticeStateStore;
  output: OutputChannelLike;
  window: WindowLike;
  registerCommand: RegisterCommand;
};

export function registerExtensionCommands(
  dependencies: ExtensionCommandDependencies
): readonly DisposableLike[] {
  const waitForNextPoll =
    dependencies.waitForNextPoll ??
    ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const pollIntervalMs = 1_000;
  const maxPollBackoffMs = 8_000;

  const runWithHandling =
    (commandId: string, run: (...args: unknown[]) => Promise<void | false>) =>
    async (...args: unknown[]) => {
    dependencies.output.appendLine(`[${commandId}] start`);
    try {
      const result = await run(...args);
      if (result === false) {
        dependencies.output.appendLine(`[${commandId}] cancelled`);
        return;
      }
      dependencies.output.appendLine(`[${commandId}] success`);
      dependencies.window.showInformationMessage(`[${commandId}] success`);
    } catch (error) {
      const mapped = mapExtensionError(error);
      dependencies.output.appendLine(`[${commandId}] error: ${mapped.logMessage}`);
      dependencies.window.showErrorMessage(`[${commandId}] ${mapped.userMessage}`);
    }
    };

  let latestSubmissionId: string | null = null;
  let activePollingSubmissionId: string | null = null;
  const cancelledPollingSubmissionIds = new Set<string>();

  const isTransientPollError = (error: unknown): boolean => {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('socket hang up')
    );
  };

  const presentSubmissionResult = (result: SubmissionResult): void => {
    dependencies.practiceViews?.showSubmissionResult(result);
    dependencies.practiceViews?.revealSubmission(result.submissionId);
    dependencies.output.appendLine(formatSubmissionDetail(result));
  };

  const openProblemStarterForProblem = async (problemId: string): Promise<void> => {
    const problemDetail = await dependencies.practiceCommands.fetchProblemDetail(problemId);
    dependencies.practiceViews?.showProblemDetail?.(problemDetail);
    const openedFilePath = await dependencies.problemStarterWorkspace?.openProblemStarter(problemDetail);
    if (openedFilePath) {
      await dependencies.localStateStore?.recordLastOpenedFile(problemId, openedFilePath);
    }
  };

  const pollSubmissionLifecycle = async (submissionId: string): Promise<void> => {
    let retryCount = 0;
    activePollingSubmissionId = submissionId;
    cancelledPollingSubmissionIds.delete(submissionId);

    while (true) {
      if (cancelledPollingSubmissionIds.has(submissionId)) {
        dependencies.output.appendLine(`Polling cancelled for submission ${submissionId}.`);
        if (activePollingSubmissionId === submissionId) {
          activePollingSubmissionId = null;
        }
        return;
      }

      try {
        const result = await dependencies.practiceCommands.pollSubmissionResult(submissionId);
        retryCount = 0;
        presentSubmissionResult(result);

        if (result.status === 'finished' || result.status === 'failed') {
          if (activePollingSubmissionId === submissionId) {
            activePollingSubmissionId = null;
          }
          return;
        }

        await waitForNextPoll(pollIntervalMs);
      } catch (error) {
        if (cancelledPollingSubmissionIds.has(submissionId)) {
          dependencies.output.appendLine(`Polling cancelled for submission ${submissionId}.`);
          if (activePollingSubmissionId === submissionId) {
            activePollingSubmissionId = null;
          }
          return;
        }

        if (!isTransientPollError(error)) {
          if (activePollingSubmissionId === submissionId) {
            activePollingSubmissionId = null;
          }
          throw error;
        }

        retryCount += 1;
        const backoffMs = Math.min(pollIntervalMs * 2 ** retryCount, maxPollBackoffMs);
        dependencies.output.appendLine(
          `Retrying submission ${submissionId} status poll after transient error in ${backoffMs}ms.`
        );
        await waitForNextPoll(backoffMs);
      }
    }
  };

  const resolveSelectedProblemId = async (preferredProblemId?: string): Promise<string> => {
    if (preferredProblemId?.trim()) {
      dependencies.practiceViews?.setSelectedProblem?.(preferredProblemId);
      await dependencies.localStateStore?.setSelectedProblemId(preferredProblemId);
      return preferredProblemId;
    }

    const selectedProblemId = dependencies.practiceViews?.getSelectedProblemId?.();
    if (selectedProblemId) {
      await dependencies.localStateStore?.setSelectedProblemId(selectedProblemId);
      return selectedProblemId;
    }

    const problems = await dependencies.practiceCommands.fetchPublishedProblems();
    dependencies.practiceViews?.showProblems(problems);
    if (problems.length === 0) {
      throw new Error('No published problems available');
    }

    const pickedProblem = await dependencies.window.showQuickPick?.(
      problems.map((problem) => ({
        label: problem.title,
        description: problem.problemId,
        problemId: problem.problemId
      })),
      {
        placeHolder: 'Select a problem to submit against',
        ignoreFocusOut: true
      }
    );

    if (!pickedProblem) {
      throw new Error('Problem selection is required');
    }

    dependencies.practiceViews?.setSelectedProblem?.(pickedProblem.problemId);
    await dependencies.localStateStore?.setSelectedProblemId(pickedProblem.problemId);
    return pickedProblem.problemId;
  };

  const resolveCurrentPythonFileSource = (): string => {
    const activeDocument = dependencies.window.activeTextEditor?.document;
    if (!activeDocument) {
      throw new Error('Open a Python file before submitting');
    }

    const fileName = activeDocument.fileName?.trim() ?? '';
    if (!fileName.toLowerCase().endsWith('.py')) {
      throw new Error('Active editor must be a .py file');
    }

    const sourceCode = activeDocument.getText().trim();
    if (!sourceCode) {
      throw new Error('Active editor is empty');
    }

    return sourceCode;
  };

  const resolveProblemEntryFunction = async (problemId: string): Promise<string> => {
    try {
      const problemDetail = await dependencies.practiceCommands.fetchProblemDetail(problemId);
      const metadataEntrypoint = problemDetail.entryFunction?.trim();
      if (metadataEntrypoint) {
        return metadataEntrypoint;
      }

      const starterCodeEntrypoint = problemDetail.starterCode
        ?.match(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m)?.[1]
        ?.trim();
      if (starterCodeEntrypoint) {
        return starterCodeEntrypoint;
      }
    } catch {
      return 'solve';
    }
    return 'solve';
  };

  const inferProblemIdFromCurrentWorkspaceFile = (): string | null => {
    const activeDocument = dependencies.window.activeTextEditor?.document;
    const fileName = activeDocument?.fileName?.trim();
    if (!fileName) {
      return null;
    }

    const normalizedPath = fileName.replaceAll('\\', '/');
    const match = normalizedPath.match(/(?:^|\/)\.oj\/problems\/([^/]+)\.py$/i);
    if (!match?.[1]) {
      return null;
    }

    return match[1];
  };

  const resolveSubmissionSource = async (): Promise<string> => {
    const activeDocument = dependencies.window.activeTextEditor?.document;
    if (activeDocument?.languageId === 'python') {
      const source = activeDocument.getText().trim();
      if (source.length > 0) {
        return source;
      }
    }

    return (
      (await dependencies.window.showInputBox({
        prompt: 'Enter Python source code to submit',
        placeHolder: 'print(42)',
        value: 'print(42)',
        ignoreFocusOut: true
      })) ?? ''
    );
  };

  const promptForLoginRequest = async (): Promise<{ email: string; password: string } | null> => {
    const loginView = createLoginViewModel();
    const email = await dependencies.window.showInputBox({
      prompt: `${loginView.title}: email`,
      placeHolder: 'student1@example.com or admin@example.com',
      ignoreFocusOut: true
    });
    if (email === undefined) {
      return null;
    }

    const password = await dependencies.window.showInputBox({
      prompt: `${loginView.title}: password`,
      placeHolder: 'Enter your password',
      password: true,
      ignoreFocusOut: true
    });
    if (password === undefined) {
      return null;
    }

    return { email, password };
  };

  return [
    dependencies.registerCommand(
      'oj.login',
      runWithHandling('oj.login', async () => {
        const request = await promptForLoginRequest();
        if (!request) {
          return false;
        }

        await dependencies.authCommands.login(request);
        dependencies.output.appendLine('Authenticated');
      })
    ),
    dependencies.registerCommand(
      'oj.practice.fetchProblems',
      runWithHandling('oj.practice.fetchProblems', async () => {
        const problems = await dependencies.practiceCommands.fetchPublishedProblems();
        dependencies.practiceViews?.showProblems(problems);
        dependencies.window.showInformationMessage(
          problems.length === 0
            ? 'No published problems available.'
            : `Loaded ${problems.length} problems.`
        );
      })
    ),
    dependencies.registerCommand(
      'oj.practice.cancelPolling',
      runWithHandling('oj.practice.cancelPolling', async () => {
        if (!activePollingSubmissionId) {
          dependencies.window.showInformationMessage('No active submission polling to cancel.');
          return;
        }

        cancelledPollingSubmissionIds.add(activePollingSubmissionId);
        dependencies.window.showInformationMessage(
          `Cancelled polling for submission ${activePollingSubmissionId}.`
        );
      })
    ),
    dependencies.registerCommand(
      'oj.practice.openProblemStarter',
      runWithHandling('oj.practice.openProblemStarter', async (...args: unknown[]) => {
        const explicitProblemId = typeof args[0] === 'string' ? args[0] : '';
        const problemId = explicitProblemId || (await resolveSelectedProblemId());
        await openProblemStarterForProblem(problemId);
      })
    ),
    dependencies.registerCommand(
      'oj.practice.submitCode',
      runWithHandling('oj.practice.submitCode', async () => {
        const problemId = await resolveSelectedProblemId();
        const sourceCode = await resolveSubmissionSource();
        const submission = await dependencies.practiceCommands.submitCode({
          problemId,
          language: 'python',
          sourceCode
        });
        latestSubmissionId = submission.submissionId;
        await dependencies.localStateStore?.recordLastSubmission(problemId, submission.submissionId);
        dependencies.practiceViews?.showSubmissionCreated(submission.submissionId);
        presentSubmissionResult({ submissionId: submission.submissionId, status: 'queued' });
        dependencies.output.appendLine(`Submitted: ${submission.submissionId}`);
        dependencies.window.showInformationMessage('Submission queued.');
        await pollSubmissionLifecycle(submission.submissionId);
      })
    ),
    dependencies.registerCommand(
      'oj.practice.submitCurrentFile',
      runWithHandling('oj.practice.submitCurrentFile', async () => {
        const inferredProblemId = inferProblemIdFromCurrentWorkspaceFile();
        const problemId = await resolveSelectedProblemId(inferredProblemId ?? undefined);
        const sourceCode = resolveCurrentPythonFileSource();
        const entryFunction = await resolveProblemEntryFunction(problemId);
        const extractedPayload = extractSubmitPayload(sourceCode, entryFunction);
        const submission = await dependencies.practiceCommands.submitCode({
          problemId,
          language: 'python',
          sourceCode: extractedPayload
        });
        latestSubmissionId = submission.submissionId;
        await dependencies.localStateStore?.recordLastSubmission(problemId, submission.submissionId);
        dependencies.practiceViews?.showSubmissionCreated(submission.submissionId);
        presentSubmissionResult({ submissionId: submission.submissionId, status: 'queued' });
        dependencies.output.appendLine(`Submitted current file: ${submission.submissionId}`);
        dependencies.window.showInformationMessage('Submission queued.');
        await pollSubmissionLifecycle(submission.submissionId);
      })
    ),
    dependencies.registerCommand(
      'oj.practice.viewResult',
      runWithHandling('oj.practice.viewResult', async () => {
        if (!latestSubmissionId) {
          dependencies.window.showInformationMessage('No submission selected yet.');
          return;
        }
        const result = await dependencies.practiceCommands.pollSubmissionResult(latestSubmissionId);
        dependencies.practiceViews?.showSubmissionResult(result);
        dependencies.practiceViews?.revealSubmission(result.submissionId);
        dependencies.output.appendLine(formatSubmissionDetail(result));
        if (result.status === 'queued' || result.status === 'running') {
          dependencies.window.showInformationMessage(
            `Submission is still ${result.status}. Run OJ: View Result again shortly.`
          );
        }
      })
    ),
    dependencies.registerCommand(
      'oj.practice.selectProblem',
      runWithHandling('oj.practice.selectProblem', async (...args: unknown[]) => {
        const problemId = typeof args[0] === 'string' ? args[0] : '';
        if (!problemId) {
          dependencies.window.showInformationMessage('No problem selected yet. Run OJ: Fetch Problems first.');
          return;
        }
        dependencies.practiceViews?.setSelectedProblem?.(problemId);
        await dependencies.localStateStore?.setSelectedProblemId(problemId);
        const problemDetail = await dependencies.practiceCommands.fetchProblemDetail(problemId);
        dependencies.practiceViews?.showProblemDetail?.(problemDetail);
      })
    ),
    dependencies.registerCommand(
      'oj.engagement.favoriteProblem',
      runWithHandling('oj.engagement.favoriteProblem', async () => {
        const favorites = await dependencies.engagementCommands.favoriteProblem('problem-1');
        dependencies.output.appendLine(`Favorites: ${favorites.join(',')}`);
      })
    ),
    dependencies.registerCommand(
      'oj.engagement.submitReview',
      runWithHandling('oj.engagement.submitReview', async () => {
        const reviews = await dependencies.engagementCommands.submitReview({
          problemId: 'problem-1',
          content: 'Useful problem',
          sentiment: 'like'
        });
        dependencies.output.appendLine(`Reviews for problem-1: ${reviews.length}`);
      })
    ),
    dependencies.registerCommand(
      'oj.stats.show',
      runWithHandling('oj.stats.show', async () => {
        dependencies.output.appendLine(await dependencies.engagementCommands.showPublicStats());
      })
    ),
    dependencies.registerCommand(
      'oj.ranking.show',
      runWithHandling('oj.ranking.show', async () => {
        const lines = await dependencies.engagementCommands.showPublicRanking();
        for (const line of lines) {
          dependencies.output.appendLine(line);
        }
      })
    )
  ];
}
