import { EngagementCommands } from './engagement/EngagementCommands';
import { AuthCommands } from './auth/AuthCommands';
import { PracticeCommands } from './practice/PracticeCommands';
import { mapExtensionError } from './errors/ExtensionErrorMapper';
import { PublishedProblem, SubmissionResult } from './api/PracticeApiClient';
import { formatSubmissionDetail } from './ui/PracticeViewState';

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
    };
  };
};

export type ExtensionCommandDependencies = {
  authCommands: AuthCommands;
  practiceCommands: PracticeCommands;
  engagementCommands: EngagementCommands;
  practiceViews?: {
    showProblems: (problems: readonly PublishedProblem[]) => void;
    showSubmissionCreated: (submissionId: string) => void;
    showSubmissionResult: (result: SubmissionResult) => void;
    revealSubmission: (submissionId: string) => void;
    revealProblem: (problemId: string) => Promise<void>;
  };
  output: OutputChannelLike;
  window: WindowLike;
  registerCommand: RegisterCommand;
};

export function registerExtensionCommands(
  dependencies: ExtensionCommandDependencies
): readonly DisposableLike[] {
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
        const problems = await dependencies.practiceCommands.fetchPublishedProblems();
        const sourceCode = await resolveSubmissionSource();
        const submission = await dependencies.practiceCommands.submitCode({
          problemId: problems[0]?.problemId ?? 'problem-1',
          language: 'python',
          sourceCode
        });
        latestSubmissionId = submission.submissionId;
        dependencies.practiceViews?.showSubmissionCreated(submission.submissionId);
        dependencies.output.appendLine(`Submitted: ${submission.submissionId}`);
        dependencies.window.showInformationMessage(
          `Submission ${submission.submissionId} queued. Run OJ: View Result to refresh its status.`
        );
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
        await dependencies.practiceViews?.revealProblem(problemId);
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
