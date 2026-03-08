import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EngagementCommands } from '../engagement/EngagementCommands';
import { AuthCommands } from '../auth/AuthCommands';
import { PracticeCommands } from '../practice/PracticeCommands';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';
import { registerExtensionCommands } from '../extensionCore';
import {
  InMemoryAuthClient,
  InMemoryEngagementApiClient,
  InMemoryPracticeApiClient
} from '../runtime/InMemoryExtensionClients';
import { ExtensionApiError } from '../errors/ExtensionErrorMapper';
import { ProblemStarterWorkspace } from '../ui/ProblemStarterWorkspace';
import { extractSubmitPayload } from '../submission/SubmissionPayloadExtraction';
import { LocalPracticeStateStore, MementoLike } from '../runtime/LocalPracticeStateStore';

class FakeMemento implements MementoLike {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

class FakeSecretStorage implements SecretStorageLike {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

test('registered command writes to output channel on success', async () => {
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const practiceViewCalls = {
    problems: [] as readonly { problemId: string; title: string }[],
    problemDetails: [] as readonly {
      problemId: string;
      versionId: string;
      title: string;
      statement?: string;
      starterCode?: string;
    }[],
    created: [] as readonly string[],
    results: [] as readonly {
      submissionId: string;
      status: string;
      verdict?: string;
      timeMs?: number;
      memoryKb?: number;
    }[],
    revealed: [] as string[],
    openedProblems: [] as string[],
    starterFiles: [] as string[],
    selectedProblemId: null as string | null
  };

  const tokenStore = new SessionTokenStore();
  const authCommands = new AuthCommands(new InMemoryAuthClient(), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(), tokenStore);
  const inputBoxValues = ['student1@example.com', 'secret'];

  registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    practiceViews: {
      showProblems: (problems) => {
        practiceViewCalls.problems = problems;
      },
      showProblemDetail: (problem) => {
        practiceViewCalls.problemDetails = [...practiceViewCalls.problemDetails, problem];
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
      },
      setSelectedProblem: (problemId) => {
        practiceViewCalls.selectedProblemId = problemId;
      },
      getSelectedProblemId: () => practiceViewCalls.selectedProblemId
    },
    problemStarterWorkspace: {
      openProblemStarter: async (problem: { problemId: string }) => {
        practiceViewCalls.starterFiles.push(problem.problemId);
      }
    } as unknown as ProblemStarterWorkspace,
    waitForNextPoll: async () => undefined,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/submission.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => inputBoxValues.shift() ?? 'print(42)',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();
  await handlers.get('oj.practice.fetchProblems')?.();
  await handlers.get('oj.practice.selectProblem')?.('problem-1');
  await handlers.get('oj.practice.submitCurrentFile')?.();
  await handlers.get('oj.practice.viewResult')?.();

  assert.ok(outputLines.some((line) => line.includes('[oj.login] success')));
  assert.deepEqual(practiceViewCalls.problems, [
    { problemId: 'problem-1', title: 'Two Sum' },
    { problemId: 'problem-2', title: 'FizzBuzz' }
  ]);
  assert.deepEqual(practiceViewCalls.created, ['submission-1']);
  assert.equal(practiceViewCalls.results.length, 3);
  assert.deepEqual(practiceViewCalls.results, [
    {
      submissionId: 'submission-1',
      status: 'queued'
    },
    {
      submissionId: 'submission-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    },
    {
      submissionId: 'submission-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 120,
      memoryKb: 2048
    }
  ]);
  assert.deepEqual(practiceViewCalls.revealed, ['submission-1', 'submission-1', 'submission-1']);
  assert.deepEqual(practiceViewCalls.problemDetails, [
    {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statementMarkdown: 'Solve Two Sum.',
      entryFunction: 'solve',
      language: 'python',
      starterCode: 'def problem_1():\n    # YOUR CODE HERE\n    raise NotImplementedError\n',
      timeLimitMs: 2000,
      memoryLimitKb: 262144
    }
  ]);
  assert.deepEqual(practiceViewCalls.openedProblems, []);
  assert.deepEqual(practiceViewCalls.starterFiles, []);
  assert.ok(infoMessages.some((message) => message.includes('Loaded 2 problems.')));
  assert.ok(
    infoMessages.some((message) =>
      message.includes('Submission queued.')
    )
  );
});

test('select problem and submit current file persist per-problem local workspace state', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const localStateStore = new LocalPracticeStateStore(new FakeMemento());

  class RecordingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-local-state-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'AC' as const,
        timeMs: 10,
        memoryKb: 20
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
    localStateStore,
    waitForNextPoll: async () => undefined,
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => '/workspace/.oj/problems/problem-1.py'
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/workspace/.oj/problems/problem-1.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
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

  await handlers.get('oj.practice.selectProblem')?.('problem-1');
  await handlers.get('oj.practice.openProblemStarter')?.('problem-1');
  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(localStateStore.getSelectedProblemId(), 'problem-1');
  assert.deepEqual(localStateStore.getProblemState('problem-1'), {
    lastOpenedFilePath: '/workspace/.oj/problems/problem-1.py',
    lastSubmissionId: 'submission-local-state-1'
  });
});

test('select problem updates detail state only and does not auto-open files', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const shownErrors: string[] = [];
  const detailCalls: string[] = [];
  const revealedProblems: string[] = [];
  const openedStarters: string[] = [];
  const detailedProblems: Array<{
    problemId: string;
    versionId: string;
    title: string;
    statementMarkdown?: string;
    statement?: string;
    starterCode?: string;
  }> = [];

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      detailCalls.push(problemId);
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Two Sum',
        statementMarkdown: 'Solve it',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n'
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
      revealProblem: async (problemId) => {
        revealedProblems.push(problemId);
      },
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async (problem: { problemId: string }) => {
        openedStarters.push(problem.problemId);
      }
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.selectProblem')?.('problem-1');

  assert.deepEqual(detailCalls, ['problem-1']);
  assert.deepEqual(detailedProblems, [
    {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statementMarkdown: 'Solve it',
      entryFunction: 'solve',
      starterCode: 'def solve():\n    return 42\n'
    }
  ]);
  assert.deepEqual(revealedProblems, []);
  assert.deepEqual(openedStarters, []);
  assert.deepEqual(shownErrors, []);
});

test('select problem keeps detail flow alive when statement content is missing', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const shownErrors: string[] = [];
  const openedStarters: string[] = [];
  const detailedProblems: Array<{
    problemId: string;
    versionId: string;
    title: string;
    statementMarkdown?: string;
    starterCode?: string;
  }> = [];

  class MissingStatementPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Two Sum',
        statementMarkdown: '',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n'
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new MissingStatementPracticeCommands(
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
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async (problem: { problemId: string }) => {
        openedStarters.push(problem.problemId);
      }
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.selectProblem')?.('problem-1');

  assert.deepEqual(detailedProblems, [
    {
      problemId: 'problem-1',
      versionId: 'problem-1-v1',
      title: 'Two Sum',
      statementMarkdown: '',
      entryFunction: 'solve',
      starterCode: 'def solve():\n    return 42\n'
    }
  ]);
  assert.deepEqual(openedStarters, []);
  assert.deepEqual(shownErrors, []);
});

test('open problem starter command opens and records the selected problem file', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const localStateStore = new LocalPracticeStateStore(new FakeMemento());
  const fetchedDetails: string[] = [];
  const openedStarters: string[] = [];

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      fetchedDetails.push(problemId);
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Collapse Identical Digits',
        statementMarkdown: 'Solve it',
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
    localStateStore,
    practiceViews: {
      showProblems: () => undefined,
      showProblemDetail: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: (problemId) => {
        void localStateStore.setSelectedProblemId(problemId);
      },
      getSelectedProblemId: () => 'collapse'
    },
    problemStarterWorkspace: {
      openProblemStarter: async (problem: { problemId: string }) => {
        openedStarters.push(problem.problemId);
        return `/workspace/.oj/problems/${problem.problemId}.py`;
      }
    } as unknown as ProblemStarterWorkspace,
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

  await handlers.get('oj.practice.openProblemStarter')?.('collapse');

  assert.deepEqual(fetchedDetails, ['collapse']);
  assert.deepEqual(openedStarters, ['collapse']);
  assert.equal(
    localStateStore.getProblemState('collapse')?.lastOpenedFilePath,
    '/workspace/.oj/problems/collapse.py'
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
      showInputBox: async () => 'print(42)',
      showQuickPick: async (items) => items[0]
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

test('login command prompts for email and password before calling auth login', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let receivedRequest: { email: string; password: string } | null = null;
  const shownPrompts: string[] = [];
  const inputBoxValues = ['admin@example.com', 'ignored'];

  class RecordingAuthCommands extends AuthCommands {
    override async login(request: { email: string; password: string }): Promise<{
      email: string | null;
      role: string | null;
    }> {
      receivedRequest = request;
      return {
        email: request.email,
        role: null
      };
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
      showInputBox: async (options) => {
        shownPrompts.push(options?.prompt ?? '');
        return inputBoxValues.shift();
      },
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.deepEqual(receivedRequest, {
    email: 'admin@example.com',
    password: 'ignored'
  });
  assert.deepEqual(shownPrompts, ['OJ Login: email', 'OJ Login: password']);
});

test('login command cancels cleanly when email prompt is dismissed', async () => {
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const shownErrors: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let loginCalls = 0;

  class RecordingAuthCommands extends AuthCommands {
    override async login(): Promise<{ email: string | null; role: string | null }> {
      loginCalls += 1;
      return {
        email: null,
        role: null
      };
    }
  }

  registerExtensionCommands({
    authCommands: new RecordingAuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new PracticeCommands(new InMemoryPracticeApiClient(), new SessionTokenStore()),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => undefined,
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.equal(loginCalls, 0);
  assert.deepEqual(shownErrors, []);
  assert.deepEqual(infoMessages, []);
  assert.ok(outputLines.includes('[oj.login] cancelled'));
});

test('login command cancels cleanly when password prompt is dismissed', async () => {
  const outputLines: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let loginCalls = 0;
  const inputBoxValues = ['student1@example.com', undefined];

  class RecordingAuthCommands extends AuthCommands {
    override async login(): Promise<{ email: string | null; role: string | null }> {
      loginCalls += 1;
      return {
        email: null,
        role: null
      };
    }
  }

  registerExtensionCommands({
    authCommands: new RecordingAuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new PracticeCommands(new InMemoryPracticeApiClient(), new SessionTokenStore()),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => inputBoxValues.shift(),
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.equal(loginCalls, 0);
  assert.ok(outputLines.includes('[oj.login] cancelled'));
});

test('login command reports invalid credentials and does not persist token', async () => {
  const outputLines: string[] = [];
  const shownErrors: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const secrets = new FakeSecretStorage();
  const tokenStore = new SessionTokenStore(secrets);
  const inputBoxValues = ['student1@example.com', 'wrong'];

  class FailingAuthClient extends InMemoryAuthClient {
    override async login(): Promise<{ accessToken: string }> {
      throw new ExtensionApiError(401, {
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'invalid credentials'
        }
      });
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new FailingAuthClient(), tokenStore),
    practiceCommands: new PracticeCommands(new InMemoryPracticeApiClient(), new SessionTokenStore()),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: (message) => shownErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => inputBoxValues.shift(),
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.equal(tokenStore.getAccessToken(), null);
  const restoredStore = new SessionTokenStore(secrets);
  await restoredStore.hydrate();
  assert.equal(restoredStore.getAccessToken(), null);
  assert.ok(
    shownErrors.includes('[oj.login] Invalid email or password. Run OJ: Login and try again.')
  );
  assert.ok(outputLines.some((line) => line.includes('[oj.login] error: API 401 AUTH_INVALID_CREDENTIALS')));
});

test('login command stores token in SecretStorage on success', async () => {
  const outputLines: string[] = [];
  const infoMessages: string[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const secrets = new FakeSecretStorage();
  const tokenStore = new SessionTokenStore(secrets);
  const inputBoxValues = ['admin@example.com', 'ignored'];

  class RecordingAuthClient extends InMemoryAuthClient {
    override async login(request: { email: string; password: string }): Promise<{ accessToken: string }> {
      assert.deepEqual(request, {
        email: 'admin@example.com',
        password: 'ignored'
      });
      return { accessToken: 'admin-token' };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new RecordingAuthClient(), tokenStore),
    practiceCommands: new PracticeCommands(new InMemoryPracticeApiClient(), new SessionTokenStore()),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => inputBoxValues.shift(),
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.login')?.();

  assert.equal(tokenStore.getAccessToken(), 'admin-token');
  const restoredStore = new SessionTokenStore(secrets);
  await restoredStore.hydrate();
  assert.equal(restoredStore.getAccessToken(), 'admin-token');
  assert.ok(outputLines.includes('Authenticated'));
  assert.ok(infoMessages.includes('[oj.login] success'));
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
      showInputBox: async () => 'print(42)',
      showQuickPick: async (items) => items[0]
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
      showInputBox: async () => 'print(42)',
      showQuickPick: async (items) => items[0]
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

test('submit current file uses the active python editor and selected problem', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedRequest: { problemId: string; sourceCode: string } | null = null;
  let selectedProblemId: string | null = null;

  class RecordingPracticeCommands extends PracticeCommands {
    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedRequest = {
        problemId: request.problemId,
        sourceCode: request.sourceCode
      };
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
      revealProblem: async () => undefined,
      setSelectedProblem: (problemId) => {
        selectedProblemId = problemId;
      },
      getSelectedProblemId: () => selectedProblemId
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'def solve():\n    return "from editor"\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => {
        throw new Error('input should not be used');
      },
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.selectProblem')?.('problem-1');
  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.deepEqual(submittedRequest, {
    problemId: 'problem-1',
    sourceCode: 'def solve():\n    return "from editor"\n'
  });
});

test('submit code uses the selected problem instead of defaulting to the first fetched problem', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedRequest: { problemId: string; sourceCode: string } | null = null;
  let selectedProblemId: string | null = 'problem-2';

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [
        { problemId: 'problem-1', title: 'Two Sum' },
        { problemId: 'problem-2', title: 'FizzBuzz' }
      ];
    }

    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedRequest = {
        problemId: request.problemId,
        sourceCode: request.sourceCode
      };
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
      revealProblem: async () => undefined,
      setSelectedProblem: (problemId) => {
        selectedProblemId = problemId;
      },
      getSelectedProblemId: () => selectedProblemId
    },
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'print("selected problem")'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => {
        throw new Error('input should not be used');
      },
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();

  assert.deepEqual(submittedRequest, {
    problemId: 'problem-2',
    sourceCode: 'print("selected problem")'
  });
});

test('submit code prompts for a problem when none is selected', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedProblemId = '';
  let quickPickShown = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [
        { problemId: 'problem-1', title: 'Two Sum' },
        { problemId: 'problem-2', title: 'FizzBuzz' }
      ];
    }

    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedProblemId = request.problemId;
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => null
    },
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'print("from editor")'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => {
        throw new Error('input should not be used');
      },
      showQuickPick: async (items) => {
        quickPickShown = true;
        return items[1];
      }
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCode')?.();

  assert.equal(quickPickShown, true);
  assert.equal(submittedProblemId, 'problem-2');
});

test('submit current file prompts for a problem when none is selected', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedProblemId = '';
  let quickPickShown = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [
        { problemId: 'problem-1', title: 'Two Sum' },
        { problemId: 'problem-2', title: 'FizzBuzz' }
      ];
    }

    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedProblemId = request.problemId;
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => null
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/submission.py',
          getText: () => 'def solve():\n    return "from file"\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'print("from prompt")',
      showQuickPick: async (items) => {
        quickPickShown = true;
        return items[1];
      }
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(quickPickShown, true);
  assert.equal(submittedProblemId, 'problem-2');
});

test('submit current file infers problem id from .oj/problems/<id>.py without prompting', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  let submittedProblemId = '';
  let quickPickShown = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async submitCode(request: {
      problemId: string;
      language: string;
      sourceCode: string;
    }): Promise<{ submissionId: string }> {
      submittedProblemId = request.problemId;
      return { submissionId: 'submission-inferred-1' };
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => null
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/workspace/.oj/problems/problem-inferred.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => {
        quickPickShown = true;
        return items[0];
      }
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(quickPickShown, false);
  assert.equal(submittedProblemId, 'problem-inferred');
});

test('submit current file rejects non-.py editors', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  let submitCalled = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async submitCode(): Promise<{ submissionId: string }> {
      submitCalled = true;
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'plaintext',
          fileName: '/tmp/readme.txt',
          getText: () => 'print("nope")'
        }
      },
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

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(submitCalled, false);
  assert.ok(
    outputLines.some((line) => line.includes('[oj.practice.submitCurrentFile] error: Active editor must be a .py file'))
  );
});

test('submit current file rejects an empty editor', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  let submitCalled = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async submitCode(): Promise<{ submissionId: string }> {
      submitCalled = true;
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => outputLines.push(line) },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => '   \n'
        }
      },
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

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(submitCalled, false);
  assert.ok(
    outputLines.some((line) => line.includes('[oj.practice.submitCurrentFile] error: Active editor is empty'))
  );
});

test('submit current file rejects missing configured entryFunction()', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  let submitCalled = false;

  class RecordingPracticeCommands extends PracticeCommands {
    override async fetchProblemDetail(problemId: string) {
      return {
        problemId,
        versionId: `${problemId}-v1`,
        title: 'Collapse Identical Digits',
        statementMarkdown: 'Solve it',
        entryFunction: 'collapse',
        starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
      };
    }

    override async submitCode(): Promise<{ submissionId: string }> {
      submitCalled = true;
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => outputLines.push(line) },
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
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(submitCalled, false);
  assert.ok(
    outputLines.some((line) =>
      line.includes('[oj.practice.submitCurrentFile] error: Submission must define a top-level collapse() function')
    )
  );
});

test('submit payload extraction keeps configured entryFunction only when no helper is referenced', () => {
  const extracted = extractSubmitPayload(`
import math

def collapse():
    """ 
    >>> collapse()
    42
    """
    return 42

def unused():
    return math.floor(2.3)

if __name__ == "__main__":
    print("debug")
`.trim(), 'collapse');

  assert.match(extracted, /^def collapse\(\):$/m);
  assert.doesNotMatch(extracted, />>> collapse/);
  assert.doesNotMatch(extracted, /^def unused\(\):$/m);
  assert.doesNotMatch(extracted, /__name__ == "__main__"/);
});

test('submit payload extraction includes configured entryFunction and referenced helper defs', () => {
  const extracted = extractSubmitPayload(`
import math

def helper(value):
    return math.floor(value)

def collapse():
    return helper(2.7)
`.trim(), 'collapse');

  assert.match(extracted, /^import math$/m);
  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def collapse\(\):$/m);
});

test('submit payload extraction includes constants required by entryFunction helper closure', () => {
  const extracted = extractSubmitPayload(`
import math
DEBUG = 999
OFFSET = 2

def helper(value):
    return math.floor(value) + OFFSET

def collapse():
    return helper(40.8)
`.trim(), 'collapse');

  assert.match(extracted, /^import math$/m);
  assert.match(extracted, /^OFFSET = 2$/m);
  assert.match(extracted, /^def helper\(value\):$/m);
  assert.match(extracted, /^def collapse\(\):$/m);
  assert.doesNotMatch(extracted, /^DEBUG = 999$/m);
});

test('submit payload extraction excludes __main__ blocks', () => {
  const extracted = extractSubmitPayload(`
def collapse():
    return 42

if __name__ == "__main__":
    import doctest
    doctest.testmod()
`.trim(), 'collapse');

  assert.match(extracted, /^def collapse\(\):$/m);
  assert.doesNotMatch(extracted, /doctest/);
  assert.doesNotMatch(extracted, /__name__ == "__main__"/);
});

test('running submission result shows actionable progress notification', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const infoMessages: string[] = [];
  let pollCount = 0;

  class RunningPracticeCommands extends PracticeCommands {
    override async fetchPublishedProblems(): Promise<readonly { problemId: string; title: string }[]> {
      return [{ problemId: 'problem-1', title: 'Two Sum' }];
    }

    override async submitCode(): Promise<{ submissionId: string }> {
      return { submissionId: 'submission-1' };
    }

    override async pollSubmissionResult(): Promise<{
      submissionId: string;
      status: 'running' | 'finished';
      verdict?: 'AC';
      timeMs?: number;
      memoryKb?: number;
    }> {
      pollCount += 1;
      if (pollCount === 1) {
        return {
          submissionId: 'submission-1',
          status: 'finished',
          verdict: 'AC',
          timeMs: 120,
          memoryKb: 2048
        };
      }

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
    waitForNextPoll: async () => undefined,
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
      showInputBox: async () => 'print(42)',
      showQuickPick: async (items) => items[0]
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
      message.includes('Submission is still running. Run OJ: View Result again shortly.')
    )
  );
});

test('submit current file polls until finished and stops on terminal state', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  const polledSubmissionIds: string[] = [];
  const reportedResults: Array<{
    submissionId: string;
    status: string;
    verdict?: string;
    timeMs?: number;
    memoryKb?: number;
  }> = [];
  let pollIndex = 0;

  class PollingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-finished-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      polledSubmissionIds.push(submissionId);
      pollIndex += 1;

      if (pollIndex === 1) {
        return { submissionId, status: 'running' as const };
      }

      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'AC' as const,
        timeMs: 123,
        memoryKb: 456
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new PollingPracticeCommands(
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
        reportedResults.push(result);
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => outputLines.push(line) },
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
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.deepEqual(polledSubmissionIds, ['submission-finished-1', 'submission-finished-1']);
  assert.deepEqual(reportedResults, [
    { submissionId: 'submission-finished-1', status: 'queued' },
    { submissionId: 'submission-finished-1', status: 'running' },
    {
      submissionId: 'submission-finished-1',
      status: 'finished',
      verdict: 'AC',
      timeMs: 123,
      memoryKb: 456
    }
  ]);
  assert.ok(
    outputLines.some((line) => line.includes('verdict=AC, time=123ms, memory=456KB'))
  );
});

test('submit current file polls until failed and stops on terminal state', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const polledSubmissionIds: string[] = [];
  const reportedResults: Array<{ submissionId: string; status: string }> = [];
  let pollIndex = 0;

  class FailingPollingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-failed-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      polledSubmissionIds.push(submissionId);
      pollIndex += 1;

      if (pollIndex === 1) {
        return { submissionId, status: 'running' as const };
      }

      return { submissionId, status: 'failed' as const };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new FailingPollingPracticeCommands(
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
        reportedResults.push({ submissionId: result.submissionId, status: result.status });
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
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
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.deepEqual(polledSubmissionIds, ['submission-failed-1', 'submission-failed-1']);
  assert.deepEqual(reportedResults, [
    { submissionId: 'submission-failed-1', status: 'queued' },
    { submissionId: 'submission-failed-1', status: 'running' },
    { submissionId: 'submission-failed-1', status: 'failed' }
  ]);
});

test('judged compile/runtime/timeout failures and API transport failures surface distinct user-visible messages', async () => {
  const judgedHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const judgedOutputLines: string[] = [];
  const judgedErrors: string[] = [];
  let pollAttempt = 0;

  class RuntimeErrorPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-runtime-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      pollAttempt += 1;

      if (pollAttempt === 1) {
        return {
          submissionId,
          status: 'finished' as const,
          verdict: 'CE' as const,
          timeMs: 11,
          memoryKb: 22,
          failureReason: 'SyntaxError: invalid syntax on line 3'
        };
      }

      if (pollAttempt === 2) {
        return {
          submissionId,
          status: 'finished' as const,
          verdict: 'RE' as const,
          timeMs: 77,
          memoryKb: 88,
          failureReason: 'ZeroDivisionError: division by zero'
        };
      }

      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'TLE' as const,
        timeMs: 2000,
        memoryKb: 99,
        failureReason: 'Execution exceeded the 2s time limit'
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new RuntimeErrorPracticeCommands(
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
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => judgedOutputLines.push(line) },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
      showErrorMessage: (message) => judgedErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      judgedHandlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await judgedHandlers.get('oj.practice.submitCurrentFile')?.();
  await judgedHandlers.get('oj.practice.submitCurrentFile')?.();
  await judgedHandlers.get('oj.practice.submitCurrentFile')?.();

  assert.ok(
    judgedOutputLines.some((line) => line.includes('Submitted current file: submission-runtime-1'))
  );
  assert.ok(
    judgedOutputLines.some((line) =>
      line.includes(
        'finished with compile error (CE), time=11ms, memory=22KB | SyntaxError: invalid syntax on line 3'
      )
    )
  );
  assert.ok(
    judgedOutputLines.some((line) =>
      line.includes(
        'finished with runtime error (RE), time=77ms, memory=88KB | ZeroDivisionError: division by zero'
      )
    )
  );
  assert.ok(
    judgedOutputLines.some((line) =>
      line.includes(
        'finished with time limit exceeded (TLE), time=2000ms, memory=99KB | Execution exceeded the 2s time limit'
      )
    )
  );
  assert.equal(judgedErrors.length, 0);

  const failingHandlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const transportErrors: string[] = [];

  class TransportFailingPracticeCommands extends PracticeCommands {
    override async submitCode(): Promise<{ submissionId: string }> {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3100'), {
        code: 'ECONNREFUSED'
      });
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new TransportFailingPracticeCommands(
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
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: () => undefined },
    window: {
      activeTextEditor: {
        document: {
          languageId: 'python',
          fileName: '/tmp/solution.py',
          getText: () => 'def solve():\n    return 42\n'
        }
      },
      showErrorMessage: (message) => transportErrors.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      failingHandlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await failingHandlers.get('oj.practice.submitCurrentFile')?.();

  assert.ok(
    transportErrors.some((message) =>
      message.includes('Unable to reach the OJ API. Check that the server is running and verify oj.apiBaseUrl')
    )
  );
});

test('submit current file retries one transient poll error before succeeding', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const outputLines: string[] = [];
  const reportedResults: Array<{ submissionId: string; status: string }> = [];
  const waitedDelays: number[] = [];
  let pollAttempts = 0;

  class RetryPollingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-retry-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      pollAttempts += 1;

      if (pollAttempts === 1) {
        throw new Error('fetch failed');
      }

      if (pollAttempts === 2) {
        return { submissionId, status: 'running' as const };
      }

      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'WA' as const,
        timeMs: 77,
        memoryKb: 88
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new RetryPollingPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    waitForNextPoll: async (delayMs) => {
      waitedDelays.push(delayMs);
    },
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: (result) => {
        reportedResults.push({ submissionId: result.submissionId, status: result.status });
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
    output: { appendLine: (line) => outputLines.push(line) },
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
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(pollAttempts, 3);
  assert.deepEqual(reportedResults, [
    { submissionId: 'submission-retry-1', status: 'queued' },
    { submissionId: 'submission-retry-1', status: 'running' },
    { submissionId: 'submission-retry-1', status: 'finished' }
  ]);
  assert.deepEqual(waitedDelays, [2000, 1000]);
  assert.ok(
    outputLines.some((line) =>
      line.includes('Retrying submission submission-retry-1 status poll after transient error in 2000ms.')
    )
  );
});

test('submit current file backs off repeatedly after transient poll errors', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const waitedDelays: number[] = [];
  let pollAttempts = 0;

  class BackoffPollingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-backoff-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      pollAttempts += 1;

      if (pollAttempts <= 2) {
        throw new Error('fetch failed');
      }

      return {
        submissionId,
        status: 'finished' as const,
        verdict: 'AC' as const,
        timeMs: 55,
        memoryKb: 66
      };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new BackoffPollingPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    waitForNextPoll: async (delayMs) => {
      waitedDelays.push(delayMs);
    },
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: () => undefined,
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
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
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(pollAttempts, 3);
  assert.deepEqual(waitedDelays, [2000, 4000]);
});

test('cancel polling stops further status requests without mutating the last known submission state', async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const infoMessages: string[] = [];
  const reportedResults: Array<{ submissionId: string; status: string }> = [];
  const waitedDelays: number[] = [];
  let pollAttempts = 0;

  class CancellablePollingPracticeCommands extends PracticeCommands {
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
      return { submissionId: 'submission-cancel-1' };
    }

    override async pollSubmissionResult(submissionId: string) {
      pollAttempts += 1;
      return { submissionId, status: 'running' as const };
    }
  }

  registerExtensionCommands({
    authCommands: new AuthCommands(new InMemoryAuthClient(), new SessionTokenStore()),
    practiceCommands: new CancellablePollingPracticeCommands(
      new InMemoryPracticeApiClient(),
      new SessionTokenStore()
    ),
    engagementCommands: new EngagementCommands(
      new InMemoryEngagementApiClient(),
      new SessionTokenStore()
    ),
    waitForNextPoll: async (delayMs) => {
      waitedDelays.push(delayMs);
      await handlers.get('oj.practice.cancelPolling')?.();
    },
    practiceViews: {
      showProblems: () => undefined,
      showSubmissionCreated: () => undefined,
      showSubmissionResult: (result) => {
        reportedResults.push({ submissionId: result.submissionId, status: result.status });
      },
      revealSubmission: () => undefined,
      revealProblem: async () => undefined,
      setSelectedProblem: () => undefined,
      getSelectedProblemId: () => 'problem-1'
    },
    problemStarterWorkspace: {
      openProblemStarter: async () => undefined
    } as unknown as ProblemStarterWorkspace,
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
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => 'ignored',
      showQuickPick: async (items) => items[0]
    },
    registerCommand: (commandId, callback) => {
      handlers.set(commandId, callback);
      return { dispose: () => undefined };
    }
  });

  await handlers.get('oj.practice.submitCurrentFile')?.();

  assert.equal(pollAttempts, 1);
  assert.deepEqual(waitedDelays, [1000]);
  assert.deepEqual(reportedResults, [
    { submissionId: 'submission-cancel-1', status: 'queued' },
    { submissionId: 'submission-cancel-1', status: 'running' }
  ]);
  assert.equal(
    infoMessages.some((message) => message.includes('Cancelled polling for submission submission-cancel-1.')),
    true
  );
});

test('problem starter workspace shows a friendly error when no workspace is open', async () => {
  const workspace = new ProblemStarterWorkspace(
    {
      showTextDocument: async () => undefined
    },
    {
      workspaceFolders: [],
      openTextDocument: async () => ({
        getText: () => '',
        languageId: 'python',
        fileName: ''
      })
    }
  );

  await assert.rejects(
    workspace.openProblemStarter({
      problemId: 'collapse',
      starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
    }),
    /Open a workspace folder before opening a problem/
  );
});

test('problem starter workspace creates the starter file when it is missing and opens it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oj-problem-workspace-'));
  const openedPaths: string[] = [];
  const shownPaths: string[] = [];
  const workspace = new ProblemStarterWorkspace(
    {
      showTextDocument: async (document) => {
        shownPaths.push(document.fileName ?? '');
      }
    },
    {
      workspaceFolders: [{ uri: { fsPath: root } }],
      openTextDocument: async (filePath) => {
        openedPaths.push(filePath);
        return {
          getText: () => '',
          languageId: 'python',
          fileName: filePath
        };
      }
    }
  );

  await workspace.openProblemStarter({
    problemId: 'collapse',
    starterCode: 'def collapse(number):\n    # YOUR CODE HERE\n    raise NotImplementedError\n'
  });

  const targetPath = path.join(root, '.oj', 'problems', 'collapse.py');
  assert.equal(await readFile(targetPath, 'utf8'), 'def collapse(number):\n    # YOUR CODE HERE\n    raise NotImplementedError\n');
  assert.deepEqual(openedPaths, [targetPath]);
  assert.deepEqual(shownPaths, [targetPath]);
});

test('problem starter workspace does not overwrite an existing file without confirmation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oj-problem-workspace-'));
  const targetPath = path.join(root, '.oj', 'problems', 'collapse.py');
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, '# student edits\nprint("keep me")\n', 'utf8');
  let promptShown = false;

  const workspace = new ProblemStarterWorkspace(
    {
      showTextDocument: async () => undefined,
      showWarningMessage: async () => {
        promptShown = true;
        return undefined;
      }
    },
    {
      workspaceFolders: [{ uri: { fsPath: root } }],
      openTextDocument: async (filePath) => ({
        getText: () => '',
        languageId: 'python',
        fileName: filePath
      })
    }
  );

  await workspace.openProblemStarter({
    problemId: 'collapse',
    starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
  });

  assert.equal(promptShown, true);
  assert.equal(await readFile(targetPath, 'utf8'), '# student edits\nprint("keep me")\n');
});
