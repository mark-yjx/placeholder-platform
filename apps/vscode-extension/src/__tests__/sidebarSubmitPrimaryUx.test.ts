import test from 'node:test';
import assert from 'node:assert/strict';
import { EngagementCommands } from '../engagement/EngagementCommands';
import { AuthCommands } from '../auth/AuthCommands';
import { PracticeCommands } from '../practice/PracticeCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { registerExtensionCommands } from '../extensionCore';
import {
  InMemoryAuthClient,
  InMemoryEngagementApiClient,
  InMemoryPracticeApiClient
} from '../runtime/InMemoryExtensionClients';

test('sidebar submit command path reports queued -> running -> finished', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const reportedStatuses: string[] = [];
  const polledSubmissionIds: string[] = [];
  let pollCount = 0;

  class SidebarSubmitPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Two Sum',
        statementMarkdown: 'Solve it',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n'
      };
    }

    override async submitCode(): Promise<{ submissionId: string }> {
      return { submissionId: 'submission-sidebar-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      polledSubmissionIds.push(submissionId);
      pollCount += 1;
      if (pollCount === 1) {
        return { submissionId, status: 'running' as const };
      }
      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'AC' as const,
        timeMs: 100,
        memoryKb: 200
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new SidebarSubmitPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    waitForNextPoll: async () => undefined,
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: (result) => {
        reportedStatuses.push(result.status);
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'unused',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.deepEqual(reportedStatuses, ['queued', 'running', 'finished']);
  assert.deepEqual(polledSubmissionIds, ['submission-sidebar-1', 'submission-sidebar-1']);
});

test('command-palette submit fallback remains functional', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const submitRequests: Array<{ problemId: string; language: string; sourceCode: string }> = [];
  const reportedStatuses: string[] = [];

  class CommandFallbackPracticeCommands extends PracticeCommands {
    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submitRequests.push(request);
      return { submissionId: 'submission-fallback-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'AC' as const,
        timeMs: 50,
        memoryKb: 128
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new CommandFallbackPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    waitForNextPoll: async () => undefined,
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: (result) => {
        reportedStatuses.push(result.status);
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'print(42)'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'unused',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();

  assert.deepEqual(submitRequests, [
    {
      problemId: 'problem-1',
      language: 'python',
      sourceCode: 'print(42)'
    }
  ]);
  assert.deepEqual(reportedStatuses, ['queued', 'finished']);
});
