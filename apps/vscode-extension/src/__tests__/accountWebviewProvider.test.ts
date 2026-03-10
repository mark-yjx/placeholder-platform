import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands, STUDENT_ONLY_EXTENSION_MESSAGE } from '../auth/AuthCommands';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';
import { ExtensionApiError } from '../errors/ExtensionErrorMapper';
import { AccountWebviewProvider } from '../ui/AccountWebviewProvider';
import { createAccountHtml, createAccountViewModel } from '../ui/AccountViewModel';

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

class FakeAuthClient implements AuthClient {
  requests: Array<{ email: string; password: string }> = [];
  exchangedCodes: string[] = [];

  constructor(
    private readonly outcome:
      | { accessToken: string; email?: string; role?: 'admin' | 'student' }
      | Error
  ) {}

  async login(request: { email: string; password: string }): Promise<{
    accessToken: string;
    email?: string;
    role?: 'admin' | 'student';
  }> {
    this.requests.push(request);
    if (this.outcome instanceof Error) {
      throw this.outcome;
    }
    return this.outcome;
  }

  getBrowserAuthUrl(mode: 'sign-in' | 'sign-up'): string {
    return `http://oj.test/auth/${mode}`;
  }

  async exchangeBrowserCode(input: { code: string }): Promise<{
    accessToken: string;
    email?: string;
    role?: 'admin' | 'student';
  }> {
    this.exchangedCodes.push(input.code);
    if (this.outcome instanceof Error) {
      throw this.outcome;
    }
    return this.outcome;
  }
}

class FakeWebview {
  html = '';
  options?: { enableScripts?: boolean };
  private listener: ((message: unknown) => unknown) | null = null;

  onDidReceiveMessage(listener: (message: unknown) => unknown) {
    this.listener = listener;
    return { dispose: () => undefined };
  }

  async dispatch(message: unknown): Promise<void> {
    await this.listener?.(message);
  }
}

test('account panel renders browser auth actions when unauthenticated', () => {
  const html = createAccountHtml(
    createAccountViewModel({
      isAuthenticated: false
    })
  );

  assert.match(html, /Student authentication now happens in your browser\./);
  assert.match(html, /Primary action/);
  assert.match(html, /New to OJ\?/);
  assert.match(html, /How it works/);
  assert.match(html, /Open browser auth/);
  assert.match(html, /Return to VS Code/);
  assert.match(html, /keep this window open/i);
  assert.doesNotMatch(html, /Administrators must use Web Admin/);
  assert.match(html, /data-command="signIn"/);
  assert.match(html, /data-command="signUp"/);
  assert.doesNotMatch(html, /data-command="fetchProblems"/);
});

test('account panel renders unauthenticated state when identity is incomplete', () => {
  const html = createAccountHtml(
    createAccountViewModel({
      isAuthenticated: true,
      email: 'student@example.com',
      role: null
    })
  );

  assert.match(html, /Student authentication now happens in your browser\./);
  assert.match(html, /data-command="signIn"/);
});

test('account panel handles successful browser sign-in flow', async () => {
  const secretStorage = new FakeSecretStorage();
  const tokenStore = new SessionTokenStore(secretStorage);
  const openExternalUrls: string[] = [];
  const inputPrompts: string[] = [];
  const authCommands = new AuthCommands(
    new FakeAuthClient({ accessToken: 'student-token', email: 'student@example.com', role: 'student' }),
    tokenStore
  );
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    authCommands,
    tokenStore,
    {
      showInputBox: async (options) => {
        inputPrompts.push(options?.prompt ?? '');
        return 'ABC123';
      },
      showInformationMessage: (message) => infoMessages.push(message),
      showErrorMessage: (message) => errorMessages.push(message)
    },
    async (url) => {
      openExternalUrls.push(url);
    }
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'signIn' });

  assert.equal(tokenStore.getAccessToken(), 'student-token');
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: 'student@example.com',
    role: 'student'
  });
  assert.deepEqual(openExternalUrls, ['http://oj.test/auth/sign-in']);
  assert.ok(inputPrompts.some((prompt) => prompt.includes('Paste the student sign-in code')));
  assert.match(webview.html, /Logged in as <strong>student@example\.com<\/strong>/);
  assert.match(webview.html, /Role: <code>student<\/code>/);
  assert.match(webview.html, /data-command="logout"/);
  assert.doesNotMatch(webview.html, /data-command="fetchProblems"/);
  assert.deepEqual(errorMessages, []);
  assert.ok(infoMessages.some((message) => message.includes('Logged in as student@example.com')));
});

test('account panel shows friendly message for failed browser sign-in flow', async () => {
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(
    new FakeAuthClient(
      new ExtensionApiError(401, {
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'invalid credentials'
        }
      })
    ),
    tokenStore
  );
  const errorMessages: string[] = [];
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    authCommands,
    tokenStore,
    {
      showInputBox: async () => 'BADCODE',
      showInformationMessage: () => undefined,
      showErrorMessage: (message) => errorMessages.push(message)
    },
    async () => undefined
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'signIn' });

  assert.equal(tokenStore.isAuthenticated(), false);
  assert.match(webview.html, /Invalid email or password\. Try again from the Account panel\./);
  assert.deepEqual(errorMessages, ['Invalid email or password. Try again from the Account panel.']);
});

test('account panel logout clears session and returns to login form', async () => {
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });

  const infoMessages: string[] = [];
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    new AuthCommands(new FakeAuthClient({ accessToken: 'student-token', role: 'student' }), tokenStore),
    tokenStore,
    {
      showInputBox: async () => undefined,
      showInformationMessage: (message) => infoMessages.push(message),
      showErrorMessage: () => undefined
    },
    async () => undefined
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'logout' });

  assert.equal(tokenStore.getAccessToken(), null);
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: null,
    role: null
  });
  assert.match(webview.html, /data-command="signIn"/);
  assert.match(webview.html, /data-command="signUp"/);
  assert.ok(infoMessages.includes('Logged out of OJ.'));
});

test('account panel clears incomplete session after browser auth', async () => {
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const authCommands = new AuthCommands(
    new FakeAuthClient({ accessToken: 'student-token' }),
    tokenStore
  );
  const errorMessages: string[] = [];
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    authCommands,
    tokenStore,
    {
      showInputBox: async () => 'ABC123',
      showInformationMessage: () => undefined,
      showErrorMessage: (message) => errorMessages.push(message)
    },
    async () => undefined
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'signIn' });

  assert.equal(tokenStore.getAccessToken(), null);
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: null,
    role: null
  });
  assert.match(webview.html, /Student authentication now happens in your browser\./);
  assert.deepEqual(errorMessages, [
    'Login failed because the account profile is incomplete. Try again or contact your instructor.'
  ]);
});

test('account panel rejects admin browser auth and clears any existing session', async () => {
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const errorMessages: string[] = [];
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    new AuthCommands(new FakeAuthClient({ accessToken: 'admin-token', role: 'admin' }), tokenStore),
    tokenStore,
    {
      showInputBox: async () => 'ABC123',
      showInformationMessage: () => undefined,
      showErrorMessage: (message) => errorMessages.push(message)
    },
    async () => undefined
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'signIn' });

  assert.equal(tokenStore.isAuthenticated(), false);
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: null,
    role: null
  });
  assert.match(webview.html, /Student authentication now happens in your browser\./);
  assert.match(webview.html, new RegExp(STUDENT_ONLY_EXTENSION_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(errorMessages, [STUDENT_ONLY_EXTENSION_MESSAGE]);
});
