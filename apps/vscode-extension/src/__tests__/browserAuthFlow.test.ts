import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserAuthUrlInput, AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { BrowserAuthFlow, createStudentAuthCallbackUri } from '../auth/BrowserAuthFlow';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';

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

class FakeStateStore {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  valuesSnapshot(): ReadonlyMap<string, unknown> {
    return this.values;
  }
}

class RecordingAuthClient implements AuthClient {
  readonly browserAuthRequests: Array<{ mode: 'sign-in' | 'sign-up'; input?: BrowserAuthUrlInput }> = [];
  readonly exchangedCodes: string[] = [];

  constructor(
    private readonly response: { accessToken: string; email?: string; role?: 'admin' | 'student' } = {
      accessToken: 'student-token',
      email: 'student@example.com',
      role: 'student'
    }
  ) {}

  async login(): Promise<{ accessToken: string; email?: string; role?: 'admin' | 'student' }> {
    return this.response;
  }

  getBrowserAuthUrl(mode: 'sign-in' | 'sign-up', input?: BrowserAuthUrlInput): string {
    this.browserAuthRequests.push({ mode, input });
    const url = new URL(`http://oj.test/auth/${mode}`);
    if (input?.callbackUri) {
      url.searchParams.set('callback_uri', input.callbackUri);
    }
    if (input?.state) {
      url.searchParams.set('oj_state', input.state);
    }
    return url.toString();
  }

  async exchangeBrowserCode(input: { code: string }): Promise<{
    accessToken: string;
    email?: string;
    role?: 'admin' | 'student';
  }> {
    this.exchangedCodes.push(input.code);
    return this.response;
  }
}

test('browser auth start opens sign-in with callback uri and state', async () => {
  const authClient = new RecordingAuthClient();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const openedUrls: string[] = [];
  const infoMessages: string[] = [];
  const stateStore = new FakeStateStore();
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => undefined
    },
    async (url) => {
      openedUrls.push(url);
    },
    () => createStudentAuthCallbackUri('vscode'),
    { stateStore }
  );

  await flow.start('sign-in');

  assert.equal(openedUrls.length, 1);
  const startedUrl = new URL(openedUrls[0]);
  assert.equal(startedUrl.pathname, '/auth/sign-in');
  assert.equal(
    startedUrl.searchParams.get('callback_uri'),
    'vscode://placeholder.placeholder-extension/auth-complete'
  );
  assert.match(String(startedUrl.searchParams.get('oj_state')), /^[0-9a-f-]{36}$/i);
  assert.equal(authClient.browserAuthRequests[0]?.mode, 'sign-in');
  assert.ok(
    infoMessages.some((message) => message.includes('VS Code will complete sign-in automatically'))
  );
  assert.ok(Array.from(stateStore.valuesSnapshot().keys()).includes('oj.auth.pendingBrowserAuth'));
});

test('browser auth start supports asynchronously resolved callback URIs', async () => {
  const authClient = new RecordingAuthClient();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const openedUrls: string[] = [];
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => undefined
    },
    async (url) => {
      openedUrls.push(url);
    },
    async () =>
      'https://example.vscode-cdn.net/extension-auth-callback?target=vscode%3A%2F%2Fplaceholder.placeholder-extension%2Fauth-complete',
    { stateStore: new FakeStateStore() }
  );

  await flow.start('sign-in');

  const startedUrl = new URL(openedUrls[0]);
  assert.equal(startedUrl.pathname, '/auth/sign-in');
  assert.equal(
    startedUrl.searchParams.get('callback_uri'),
    'https://example.vscode-cdn.net/extension-auth-callback?target=vscode%3A%2F%2Fplaceholder.placeholder-extension%2Fauth-complete'
  );
  assert.match(String(startedUrl.searchParams.get('oj_state')), /^[0-9a-f-]{36}$/i);
});

test('browser auth start opens sign-up with callback uri and state', async () => {
  const authClient = new RecordingAuthClient();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const openedUrls: string[] = [];
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: () => undefined,
      showInformationMessage: () => undefined,
      showInputBox: async () => undefined
    },
    async (url) => {
      openedUrls.push(url);
    },
    () => createStudentAuthCallbackUri('vscode-insiders'),
    { stateStore: new FakeStateStore() }
  );

  await flow.start('sign-up');

  const startedUrl = new URL(openedUrls[0]);
  assert.equal(startedUrl.pathname, '/auth/sign-up');
  assert.equal(
    startedUrl.searchParams.get('callback_uri'),
    'vscode-insiders://placeholder.placeholder-extension/auth-complete'
  );
  assert.match(String(startedUrl.searchParams.get('oj_state')), /^[0-9a-f-]{36}$/i);
});

test('valid browser auth callback completes the student session automatically', async () => {
  const authClient = new RecordingAuthClient({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const infoMessages: string[] = [];
  const stateStore = new FakeStateStore();
  let sessionChangedCount = 0;
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => undefined
    },
    async () => undefined,
    () => createStudentAuthCallbackUri('vscode'),
    {
      stateStore,
      onSessionChanged: () => {
        sessionChangedCount += 1;
      }
    }
  );

  await flow.start('sign-in');
  const pending = Array.from(stateStore.valuesSnapshot().values()).find(
    (value) => typeof value === 'object' && value !== null
  ) as { state: string };
  await flow.handleUri({
    path: '/auth-complete',
    query: `code=ABC123&oj_state=${encodeURIComponent(pending.state)}`,
    toString: () =>
      `vscode://placeholder.placeholder-extension/auth-complete?code=ABC123&oj_state=${pending.state}`
  });

  assert.deepEqual(authClient.exchangedCodes, ['ABC123']);
  assert.equal(tokenStore.getAccessToken(), 'student-token');
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: 'student@example.com',
    role: 'student'
  });
  assert.equal(sessionChangedCount, 1);
  assert.ok(infoMessages.some((message) => message.includes('Logged in as student@example.com')));
});

test('invalid callback state is rejected without exchanging the auth code', async () => {
  const authClient = new RecordingAuthClient();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const errorMessages: string[] = [];
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: (message) => errorMessages.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => undefined
    },
    async () => undefined,
    () => createStudentAuthCallbackUri('vscode'),
    { stateStore: new FakeStateStore() }
  );

  await flow.start('sign-in');
  await flow.handleUri({
    path: '/auth-complete',
    query: 'code=ABC123&oj_state=wrong-state',
    toString: () =>
      'vscode://placeholder.placeholder-extension/auth-complete?code=ABC123&oj_state=wrong-state'
  });

  assert.deepEqual(authClient.exchangedCodes, []);
  assert.equal(tokenStore.isAuthenticated(), false);
  assert.ok(errorMessages.some((message) => message.includes('state did not match')));
});

test('manual fallback code entry succeeds when callback return fails', async () => {
  const authClient = new RecordingAuthClient({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const errorMessages: string[] = [];
  const infoMessages: string[] = [];
  const stateStore = new FakeStateStore();
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: (message) => errorMessages.push(message),
      showInformationMessage: (message) => infoMessages.push(message),
      showInputBox: async () => 'FALL123'
    },
    async () => undefined,
    () => createStudentAuthCallbackUri('vscode'),
    { stateStore }
  );

  await flow.start('sign-in');
  const pending = Array.from(stateStore.valuesSnapshot().values()).find(
    (value) => typeof value === 'object' && value !== null
  ) as { state: string };
  await flow.handleUri({
    path: '/auth-complete',
    query: `oj_state=${encodeURIComponent(pending.state)}`,
    toString: () =>
      `vscode://placeholder.placeholder-extension/auth-complete?oj_state=${pending.state}`
  });
  const completed = await flow.enterFallbackCode();

  assert.equal(completed, true);
  assert.ok(
    errorMessages.some((message) => message.includes('fallback code entry from the Placeholder Practice window'))
  );
  assert.deepEqual(authClient.exchangedCodes, ['FALL123']);
  assert.ok(infoMessages.some((message) => message.includes('Logged in as student@example.com')));
});

test('browser auth callback logs request details for transport failures', async () => {
  const authClient: AuthClient = {
    async login() {
      return {
        accessToken: 'student-token',
        email: 'student@example.com',
        role: 'student'
      };
    },
    getBrowserAuthUrl(mode, input) {
      const url = new URL(`http://oj.test/auth/${mode}`);
      if (input?.callbackUri) {
        url.searchParams.set('callback_uri', input.callbackUri);
      }
      if (input?.state) {
        url.searchParams.set('oj_state', input.state);
      }
      return url.toString();
    },
    async exchangeBrowserCode() {
      throw Object.assign(new Error('fetch failed'), {
        code: 'ECONNREFUSED',
        requestMethod: 'POST',
        requestUrl: 'http://127.0.0.1:3100/auth/extension/exchange'
      });
    }
  };
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(authClient, tokenStore);
  const errorMessages: string[] = [];
  const outputLines: string[] = [];
  const stateStore = new FakeStateStore();
  const flow = new BrowserAuthFlow(
    authCommands,
    {
      showErrorMessage: (message) => errorMessages.push(message),
      showInformationMessage: () => undefined,
      showInputBox: async () => undefined
    },
    async () => undefined,
    () => createStudentAuthCallbackUri('vscode'),
    {
      output: { appendLine: (value) => outputLines.push(value) },
      stateStore
    }
  );

  await flow.start('sign-in');
  const pending = Array.from(stateStore.valuesSnapshot().values()).find(
    (value) => typeof value === 'object' && value !== null
  ) as { state: string };
  await flow.handleUri({
    path: '/auth-complete',
    query: `code=ABC123&oj_state=${encodeURIComponent(pending.state)}`,
    toString: () =>
      `vscode://placeholder.placeholder-extension/auth-complete?code=ABC123&oj_state=${pending.state}`
  });

  assert.ok(
    outputLines.some((line) =>
      line.includes(
        'Browser auth callback failed: Network error ECONNREFUSED while requesting POST http://127.0.0.1:3100/auth/extension/exchange'
      )
    )
  );
  assert.ok(
    errorMessages.some((message) =>
      message.includes(
        'Unable to reach the Placeholder student API at http://127.0.0.1:3100/auth/extension/exchange'
      )
    )
  );
});
