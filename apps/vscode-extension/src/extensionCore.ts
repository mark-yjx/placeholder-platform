import { EngagementCommands } from './engagement/EngagementCommands';
import { AuthCommands } from './auth/AuthCommands';
import { PracticeCommands } from './practice/PracticeCommands';
import { mapExtensionError } from './errors/ExtensionErrorMapper';
import { PublishedProblem, SubmissionResult } from './api/PracticeApiClient';
import { formatSubmissionDetail } from './ui/PracticeViewState';
import { ProblemStarterWorkspace } from './ui/ProblemStarterWorkspace';
import { extractSubmitPayload } from './submission/SubmissionPayloadExtraction';

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
    showSubmissionCreated: (submissionId: string) => void;
    showSubmissionResult: (result: SubmissionResult) => void;
    revealSubmission: (submissionId: string) => void;
    revealProblem: (problemId: string) => Promise<void>;
    setSelectedProblem?: (problemId: string) => void;
    getSelectedProblemId?: () => string | null;
  };
  problemStarterWorkspace?: ProblemStarterWorkspace;
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

  const runWithHandling =
    (commandId: string, run: (...args: unknown[]) => Promise<void>) =>
    async (...args: unknown[]) => {
    dependencies.output.appendLine(`[${commandId}] start`);
    try {
      await run(...args);
      dependencies.output.appendLine(`[${commandId}] success`);
      dependencies.window.showInformationMessage(`[${commandId}] success`);
    } catch (error) {
      const mapped = mapExtensionError(error);
      dependencies.output.appendLine(`[${commandId}] error: ${mapped.logMessage}`);
      dependencies.window.showErrorMessage(`[${commandId}] ${mapped.userMessage}`);
    }
    };

  let latestSubmissionId: string | null = null;

  const presentSubmissionResult = (result: SubmissionResult): void => {
    dependencies.practiceViews?.showSubmissionResult(result);
    dependencies.practiceViews?.revealSubmission(result.submissionId);
    dependencies.output.appendLine(formatSubmissionDetail(result));
  };

  const pollSubmissionLifecycle = async (submissionId: string): Promise<void> => {
    let retryCount = 0;

    while (true) {
      try {
        const result = await dependencies.practiceCommands.pollSubmissionResult(submissionId);
        retryCount = 0;
        presentSubmissionResult(result);

        if (result.status === 'finished' || result.status === 'failed') {
          return;
        }

        await waitForNextPoll(pollIntervalMs);
      } catch (error) {
        if (retryCount >= 1) {
          throw error;
        }

        retryCount += 1;
        dependencies.output.appendLine(
          `Retrying submission ${submissionId} status poll after transient error.`
        );
        await waitForNextPoll(pollIntervalMs);
      }
    }
  };

  const resolveSelectedProblemId = async (): Promise<string> => {
    const selectedProblemId = dependencies.practiceViews?.getSelectedProblemId?.();
    if (selectedProblemId) {
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
    return pickedProblem.problemId;
  };

  const resolveCurrentPythonFileSubmission = (): string => {
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

    return extractSubmitPayload(sourceCode);
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

  return [
    dependencies.registerCommand(
      'oj.login',
      runWithHandling('oj.login', async () => {
        await dependencies.authCommands.login({
          email: 'student1@example.com',
          password: 'secret'
        });
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
        dependencies.practiceViews?.showSubmissionCreated(submission.submissionId);
        presentSubmissionResult({ submissionId: submission.submissionId, status: 'queued' });
        dependencies.output.appendLine(`Submitted: ${submission.submissionId}`);
        dependencies.window.showInformationMessage(
          `Submission ${submission.submissionId}: status=queued`
        );
        await pollSubmissionLifecycle(submission.submissionId);
      })
    ),
    dependencies.registerCommand(
      'oj.practice.submitCurrentFile',
      runWithHandling('oj.practice.submitCurrentFile', async () => {
        const problemId = await resolveSelectedProblemId();
        const sourceCode = resolveCurrentPythonFileSubmission();
        const submission = await dependencies.practiceCommands.submitCode({
          problemId,
          language: 'python',
          sourceCode
        });
        latestSubmissionId = submission.submissionId;
        dependencies.practiceViews?.showSubmissionCreated(submission.submissionId);
        presentSubmissionResult({ submissionId: submission.submissionId, status: 'queued' });
        dependencies.output.appendLine(`Submitted current file: ${submission.submissionId}`);
        dependencies.window.showInformationMessage(
          `Submission ${submission.submissionId}: status=queued`
        );
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
            `Submission ${result.submissionId} is still ${result.status}. Run OJ: View Result again shortly.`
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
        const problemDetail = await dependencies.practiceCommands.fetchProblemDetail(problemId);
        await dependencies.problemStarterWorkspace?.openProblemStarter(problemDetail);
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
