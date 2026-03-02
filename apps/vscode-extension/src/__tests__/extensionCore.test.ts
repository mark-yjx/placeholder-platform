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
import { ExtensionApiError } from '../errors/ExtensionErrorMapper';

test('registered command writes to output channel on success', async () => {
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const practiceViewCalls = {
    problems: [] as readonly { problemId: string; title: string }[],
    created: [] as readonly string[],
    results: [] as readonly {
      submissionId: string;
      status: string;
      verdict?: string;
      timeMs?: number;
      memoryKb?: number;
    }[],
    revealed: [] as string[],
    openedProblems: [] as string[]
  };

  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new InMemoryAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);

  registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    practiceViews: {
      showProblems: (problems) => {
        practiceViewCalls.problems = problems;
      },
      showSubmissionCreated: (submissionId) => {
        practiceViewCalls.created = [...practiceViewCalls.created, submissionId];
      },
      showSubmissionResult: (result) => {
        practiceViewCalls.results = [...practiceViewCalls.results, result];
      },
      revealSubmission: (submissionId) => {
        practiceViewCalls.revealed.push(submissionId);
      },
      revealProblem: async (problemId) => {
        practiceViewCalls.openedProblems.push(problemId);
      }
    },
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();
  await handlers.get('oj.practice.fetchProblems')?.();
  await handlers.get('oj.practice.selectProblem')?.('problem-1');
  await handlers.get('oj.practice.submitCode')?.();
  await handlers.get('oj.practice.viewResult')?.();

  assert.ok(outputLines.some((line) => line.includes('[oj.login] success')));
  assert.deepEqual(practiceViewCalls.problems, [
    { problemId: 'problem-1', title: 'Two Sum' },
    { problemId: 'problem-2', title: 'FizzBuzz' }
  ]);
  assert.deepEqual(practiceViewCalls.created, ['submission-1']);
  assert.equal(practiceViewCalls.results.length, 1);
  assert.deepEqual(practiceViewCalls.results, [
    {
      submissionId: 'submission-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    }
  ]);
  assert.deepEqual(practiceViewCalls.revealed, ['submission-1']);
  assert.deepEqual(practiceViewCalls.openedProblems, ['problem-1']);
  assert.ok(infoMessages.some((message) => message.includes('Loaded 2 problems.')));
  assert.ok(
    infoMessages.some((message) =>
      message.includes('Submission submission-1 queued. Run OJ: View Result to refresh its status.')
    )
  );
});

test('fetch problems handles an empty list gracefully', async () => {
  const infoMessages: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const practiceViewCalls = {
    problems: [{ problemId: 'stale-problem', title: 'Stale Problem' }] as readonly {
      problemId: string;
      title: string;
    }[]
  };

  class EmptyPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [];
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new EmptyPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    practiceViews: {
      showProblems: (problems) => {
        practiceViewCalls.problems = problems;
      },
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined
    },
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.fetchProblems')?.();

  assert.deepEqual(practiceViewCalls.problems, []);
  assert.ok(infoMessages.includes('No published problems available.'));
});

test('login command uses the real backend student fixture credentials', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let receivedRequest: { email: string; password: string } | null = null;

  class RecordingAuthCommands extends AuthCommands {
    override async login(request: { email: string; password: string }): Promise<void> {
      receivedRequest = request;
    }
  }

  registerExtensionCommands({
    authCommands: new RecordingAuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new PracticeCommands(new InMemoryPracticeApiClient(), new SessionTokenStore()),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.deepEqual(receivedRequest, {
    email: 'student1@example.com',
    password: 'secret'
  });
});

test('command error is reported cleanly', async () => {
  const outputLines: string[] = [];
  const shownErrors: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();

  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new InMemoryAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);

  registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.fetchProblems')?.();

  class FailingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      throw new ExtensionApiError(404, {
        error: {
          code: 'PROBLEM_NOT_FOUND',
          message: 'Problem not found'
        }
      });
    }
  }

  const failingPractice = new FailingPracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const failingEngagement = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);
  const failingAuth = new AuthCommands(new InMemoryAuthClient(), tokenStore);

  const failingHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  registerExtensionCommands({
    authCommands: failingAuth,
    practiceCommands: failingPractice,
    engagementCommands: failingEngagement,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      failingHandlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await failingHandlers.get('oj.practice.fetchProblems')?.();

  assert.ok(
    outputLines.some((line) => line.includes('[oj.practice.fetchProblems] error: API 404 PROBLEM_NOT_FOUND'))
  );
  assert.ok(shownErrors.some((line) => line.includes('Problem not found')));
});

test('auth failures prompt login instead of showing raw auth error text', async () => {
  const outputLines: string[] = [];
  const shownErrors: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();

  class UnauthorizedPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      throw new ExtensionApiError(401, {
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Authentication token is invalid'
        }
      });
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new UnauthorizedPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.fetchProblems')?.();

  assert.ok(outputLines.some((line) => line.includes('API 401 AUTH_INVALID_TOKEN')));
  assert.ok(shownErrors.some((line) => line.includes('Please login to continue.')));
  assert.equal(shownErrors.some((line) => line.includes('Authentication token is invalid')), false);
});

test('submit code uses the active python editor when available', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedSource = '';

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [{ problemId: 'problem-1', title: 'Two Sum' }];
    }

    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedSource = request.sourceCode;
      return { submissionId: 'submission-1' };
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
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined
    },
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          getText: () => 'print("from editor")'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => {
        throw new Error('input should not be used');
      }
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();

  assert.equal(submittedSource, 'print("from editor")');
});

test('submit code prompts for source when there is no active python editor', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedSource = '';

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [{ problemId: 'problem-1', title: 'Two Sum' }];
    }

    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedSource = request.sourceCode;
      return { submissionId: 'submission-1' };
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
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined
    },
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print("from prompt")'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();

  assert.equal(submittedSource, 'print("from prompt")');
});

test('running submission result shows actionable progress notification', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const infoMessages: string[] = [];

  class RunningPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [{ problemId: 'problem-1', title: 'Two Sum' }];
    }

    override async submitCode(): Promise<{ submissionId: string }> {
      return { submissionId: 'submission-1' };
    }

    override async pollSubmissionResult(): Promise<{
      submissionId: string;
      status: 'running';
    }> {
      return { submissionId: 'submission-1', status: 'running' };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new RunningPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined
    },
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => 'print(42)'
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();
  await handlers.get('oj.practice.viewResult')?.();

  assert.ok(
    infoMessages.some((message) =>
      message.includes('Submission submission-1 is still running. Run OJ: View Result again shortly.')
    )
  );
});
