import { SessionTokenStore } from '../auth/SessionTokenStore';
import { PracticeCommands } from '../practice/PracticeCommands';
import { PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';

export type OutputChannelLike = {
  appendLine(value: string): void;
};

export type PracticeViewsLike = {
  showProblems(problems: readonly PublishedProblem[]): void;
  showSubmissionResult(result: SubmissionResult): void;
};

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
