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

export async function restorePracticeStateOnStartup(options: {
  apiBaseUrl: string;
  tokenStore: SessionTokenStore;
  practiceCommands: PracticeCommands;
  practiceViews: PracticeViewsLike;
  output: OutputChannelLike;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.output.appendLine(`Practice state restore failed: ${message}`);
  }
}
