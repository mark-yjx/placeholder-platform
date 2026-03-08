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

test('selecting a problem updates sidebar detail state with fetched detail', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const detailedProblems: Array<{
    problemId: string;
    versionId: string;
    title: string;
    statementMarkdown?: string;
    entryFunction?: string;
    starterCode?: string;
  }> = [];

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Collapse Identical Digits',
        statementMarkdown: '# Collapse Identical Digits\n\nCollapse duplicate digits.',
        entryFunction: 'collapse',
        starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new RecordingPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: (problem) => detailedProblems.push(problem),
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'collapse'
    },
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.selectProblem')?.('collapse');

  assert.deepEqual(detailedProblems, [
    {
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits',
      statementMarkdown: '# Collapse Identical Digits\n\nCollapse duplicate digits.',
      entryFunction: 'collapse',
      starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
    }
  ]);
});

test('selecting a problem normalizes missing detail fields instead of throwing', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const detailedProblems: Array<{
    problemId: string;
    versionId: string;
    title?: string;
    statementMarkdown?: string;
    entryFunction?: string;
    starterCode?: string;
  }> = [];

  class LegacyPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: undefined as unknown as string,
        statementMarkdown: undefined as unknown as string,
        entryFunction: undefined as unknown as string,
        starterCode: 'print(42)\n'
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new LegacyPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: (problem) => detailedProblems.push(problem),
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'legacy-problem'
    },
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.selectProblem')?.('legacy-problem');

  assert.deepEqual(detailedProblems, [
    {
      problemId: 'legacy-problem',
      versionId: 'legacy-problem-v1',
      title: 'Untitled problem',
      statementMarkdown: '',
      entryFunction: 'Not available',
      starterCode: 'print(42)\n'
    }
  ]);
});
