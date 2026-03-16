import test from 'node:test';
import assert from 'node:assert/strict';
import { registerExtensionCommands } from '../extensionCore';
import { PracticeCommands } from '../practice/PracticeCommands';
import { AuthCommands } from '../auth/AuthCommands';
import { EngagementCommands } from '../engagement/EngagementCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { LocalPracticeStateStore } from '../runtime/LocalPracticeStateStore';
import {
  InMemoryAuthClient,
  InMemoryEngagementApiClient,
  InMemoryPracticeApiClient
} from '../runtime/InMemoryExtensionClients';

test('run public tests command executes student-visible manifest public tests locally', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const tokenStore = new SessionTokenStore();

  class PublicTestPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Collapse Identical Digits',
        statementMarkdown: '# Collapse Identical Digits',
        entryFunction: 'collapse',
        language: 'python' as const,
        starterCode: 'def collapse(number):\n    raise NotImplementedError\n',
        timeLimitMs: 2000,
        memoryLimitKb: 262144,
        publicTests: [
          { input: 0, output: 0 },
          { input: 112233, output: 123 }
        ]
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), tokenStore),
    practiceCommands: new PublicTestPracticeCommands(new InMemoryPracticeApiClient(), tokenStore),
    engagementCommands: new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore),
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => null
    },
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/workspace/.oj/problems/collapse.py',
          getText: () =>
            'def collapse(number):\n    return int("".join(ch for i, ch in enumerate(str(abs(number))) if i == 0 or ch != str(abs(number))[i - 1])) * (-1 if number < 0 else 1)\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => undefined
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.runPublicTests')?.('collapse');

  assert.ok(outputLines.some((line) => line.includes('Local public tests for collapse: 2/2 passed')));
  assert.ok(infoMessages.includes('All 2 public tests passed locally.'));
});

test('run public tests command reuses the stored starter file when the coding file is not focused', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const openedDocuments: string[] = [];
  const tokenStore = new SessionTokenStore();
  const persistedState = new Map<string, unknown>();
  const localStateStore = new LocalPracticeStateStore({
    get: <T>(key: string, defaultValue?: T) =>
      (persistedState.has(key) ? (persistedState.get(key) as T | undefined) : defaultValue) as
        | T
        | undefined,
    update: async (key, value) => {
      if (value === undefined) {
        persistedState.delete(key);
        return;
      }
      persistedState.set(key, value);
    }
  });
  await localStateStore.recordLastOpenedFile('collapse', '/workspace/.oj/problems/collapse.py');

  class PublicTestPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Collapse Identical Digits',
        statementMarkdown: '# Collapse Identical Digits',
        entryFunction: 'collapse',
        language: 'python' as const,
        starterCode: 'def collapse(number):\n    raise NotImplementedError\n',
        timeLimitMs: 2000,
        memoryLimitKb: 262144,
        publicTests: [
          { input: 0, output: 0 },
          { input: 112233, output: 123 }
        ]
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), tokenStore),
    practiceCommands: new PublicTestPracticeCommands(new InMemoryPracticeApiClient(), tokenStore),
    engagementCommands: new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore),
    localStateStore,
    workspace: {
      openTextDocument: async (filePath) => {
        openedDocuments.push(filePath);
        return {
          languageId: 'python',
          fileName: filePath,
          getText: () =>
            'def collapse(number):\n    return int("".join(ch for i, ch in enumerate(str(abs(number))) if i == 0 or ch != str(abs(number))[i - 1])) * (-1 if number < 0 else 1)\n'
        };
      }
    },
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => null
    },
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => undefined
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.runPublicTests')?.('collapse');

  assert.deepEqual(openedDocuments, ['/workspace/.oj/problems/collapse.py']);
  assert.ok(outputLines.some((line) => line.includes('Local public tests for collapse: 2/2 passed')));
  assert.ok(infoMessages.includes('All 2 public tests passed locally.'));
});
