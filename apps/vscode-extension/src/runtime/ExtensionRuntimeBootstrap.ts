import { SessionTokenStore } from '../auth/SessionTokenStore';
import { PracticeCommands } from '../practice/PracticeCommands';
import { ProblemDetail, PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';
import { LocalPracticeStateStore } from './LocalPracticeStateStore';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolveProblemStatementMarkdown } from '../ui/PracticeViewState';

export type OutputChannelLike = {
  appendLine(value: string): void;
};

export type PracticeViewsLike = {
  showProblems(problems: readonly PublishedProblem[]): void;
  showSubmissionResult(result: SubmissionResult): void;
  showProblemDetail?(problem: ProblemDetail): void;
  setSelectedProblem?(problemId: string): void;
};

export type ProblemStarterWorkspaceRestoreLike = {
  openProblemStarter(problem: { problemId: string; starterCode?: string }): Promise<string>;
  reopenProblemStarter(filePath: string): Promise<void>;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeProblemDetail(requestedProblemId: string, problem: ProblemDetail): ProblemDetail {
  return {
    ...problem,
    problemId: problem.problemId?.trim() || requestedProblemId,
    title: problem.title?.trim() || 'Untitled problem',
    statementMarkdown: resolveProblemStatementMarkdown(problem) ?? '',
    entryFunction: problem.entryFunction?.trim() ?? 'Not available'
  };
}

export async function probeApiHealth(apiBaseUrl: string): Promise<{
  healthz: string;
  readyz: string;
}> {
  const [healthz, readyz] = await Promise.all([
    fetch(`${apiBaseUrl}/healthz`),
    fetch(`${apiBaseUrl}/readyz`)
  ]);

  const [healthzBody, readyzBody] = await Promise.all([
    healthz.json() as Promise<{ status?: string }>,
    readyz.json() as Promise<{ status?: string }>
  ]);

  return {
    healthz: healthzBody.status ?? 'unknown',
    readyz: readyzBody.status ?? 'unknown'
  };
}

export async function restorePracticeState(options: {
  tokenStore: SessionTokenStore;
  practiceCommands: PracticeCommands;
  practiceViews: PracticeViewsLike;
  output: OutputChannelLike;
}): Promise<void> {
  if (!options.tokenStore.isAuthenticated()) {
    return;
  }

  const [problems, submissions] = await Promise.all([
    options.practiceCommands.fetchPublishedProblems(),
    options.practiceCommands.listSubmissions()
  ]);

  options.practiceViews.showProblems(problems);
  for (const submission of submissions) {
    options.practiceViews.showSubmissionResult(submission);
  }

  options.output.appendLine(
    `Restored ${problems.length} problems and ${submissions.length} submissions from API`
  );
}

export async function restorePracticeStateOnStartup(options: {
  apiBaseUrl: string;
  tokenStore: SessionTokenStore;
  practiceCommands: PracticeCommands;
  practiceViews: PracticeViewsLike;
  output: OutputChannelLike;
  localStateStore?: LocalPracticeStateStore;
  problemStarterWorkspace?: ProblemStarterWorkspaceRestoreLike;
}): Promise<void> {
  let apiReachable = false;

  try {
    const health = await probeApiHealth(options.apiBaseUrl);
    options.output.appendLine(`API health: ${health.healthz}`);
    options.output.appendLine(`API readiness: ${health.readyz}`);
    apiReachable = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.output.appendLine(`API health probe failed: ${message}`);
  }

  if (!options.tokenStore.isAuthenticated()) {
    return;
  }

  options.output.appendLine('Session restored from SecretStorage');
  if (!apiReachable) {
    options.output.appendLine(
      `Skipping practice state restore because the API at ${options.apiBaseUrl} is unavailable.`
    );
    return;
  }

  try {
    await restorePracticeState(options);
    if (options.localStateStore) {
      const persistedProblemStates = options.localStateStore.listProblemStates();
      for (const [problemId, problemState] of Object.entries(persistedProblemStates)) {
        const restoredFilePath = problemState.lastOpenedFilePath?.trim();
        if (!restoredFilePath) {
          continue;
        }

        if (await fileExists(restoredFilePath)) {
          options.output.appendLine(
            `Restored local workspace file for ${problemId}: ${restoredFilePath}`
          );
          continue;
        }

        await options.localStateStore.clearLastOpenedFile(problemId);
        options.output.appendLine(
          `Skipped missing local workspace file for ${problemId}: ${restoredFilePath}`
        );
      }
    }

    const selectedProblemId = options.localStateStore?.getSelectedProblemId();
    if (selectedProblemId) {
      options.practiceViews.setSelectedProblem?.(selectedProblemId);
      options.output.appendLine(`Restored selected problem: ${selectedProblemId}`);
      console.log('problem selected', selectedProblemId);

      try {
        const problemDetail = normalizeProblemDetail(
          selectedProblemId,
          await options.practiceCommands.fetchProblemDetail(selectedProblemId)
        );
        options.practiceViews.showProblemDetail?.(problemDetail);
        options.output.appendLine(`Restored problem detail for ${problemDetail.problemId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.output.appendLine(`Failed to restore problem detail for ${selectedProblemId}: ${message}`);
      }

      const persistedProblemState = options.localStateStore?.getProblemState(selectedProblemId);
      const restoredFilePath = persistedProblemState?.lastOpenedFilePath?.trim();
      if (restoredFilePath && (await fileExists(restoredFilePath))) {
        await options.problemStarterWorkspace?.reopenProblemStarter(restoredFilePath);
        options.output.appendLine(
          `Reopened starter workspace file for ${selectedProblemId}: ${restoredFilePath}`
        );
      }

      const restoredSubmissionId = persistedProblemState?.lastSubmissionId?.trim();
      if (restoredSubmissionId) {
        options.output.appendLine(
          `Restored last submission for ${selectedProblemId}: ${restoredSubmissionId}`
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.output.appendLine(`Practice state restore failed: ${message}`);
  }
}
