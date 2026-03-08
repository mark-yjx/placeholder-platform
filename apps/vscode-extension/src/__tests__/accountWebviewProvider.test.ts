import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
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

test('account panel renders unauthenticated login form', () => {
  const html = createAccountHtml(
    createAccountViewModel({
      isAuthenticated: false
    })
  );

  assert.match(html, /Sign in to OJ from the sidebar\./);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /data-command="login"/);
});

test('account panel handles successful login flow', async () => {
  const secretStorage = new FakeSecretStorage();
  const tokenStore = new SessionTokenStore(secretStorage);
  const authCommands = new AuthCommands(
    new FakeAuthClient({ accessToken: 'student-token', role: 'student' }),
    tokenStore
  );
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];
  let fetchProblemCalls = 0;
  const webview = new FakeWebview();
  const provider = new AccountWebviewProvider(
    authCommands,
    tokenStore,
    {
      showInformationMessage: (message) => infoMessages.push(message),
      showErrorMessage: (message) => errorMessages.push(message)
    },
    {
      fetchProblems: async () => {
        fetchProblemCalls += 1;
      }
    }
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({
    command: 'login',
    email: 'student@example.com',
    password: 'secret'
  });

  assert.equal(tokenStore.getAccessToken(), 'student-token');
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: 'student@example.com',
    role: 'student'
  });
  assert.match(webview.html, /Logged in/);
  assert.match(webview.html, /<strong>Email:<\/strong> <code>student@example\.com<\/code>/);
  assert.match(webview.html, /<strong>Role:<\/strong> <code>student<\/code>/);
  assert.match(webview.html, /data-command="logout"/);
  assert.deepEqual(errorMessages, []);
  assert.ok(infoMessages.some((message) => message.includes('Logged in as student@example.com')));

  await webview.dispatch({ command: 'fetchProblems' });
  assert.equal(fetchProblemCalls, 1);
});

test('account panel shows friendly message for failed login flow', async () => {
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
      showInformationMessage: () => undefined,
      showErrorMessage: (message) => errorMessages.push(message)
    },
    {
      fetchProblems: async () => undefined
    }
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({
    command: 'login',
    email: 'student@example.com',
    password: 'wrong-password'
  });

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
      showInformationMessage: (message) => infoMessages.push(message),
      showErrorMessage: () => undefined
    },
    {
      fetchProblems: async () => undefined
    }
  );

  provider.resolveWebviewView({ webview } as never);
  await webview.dispatch({ command: 'logout' });

  assert.equal(tokenStore.getAccessToken(), null);
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: null,
    role: null
  });
  assert.match(webview.html, /type="email"/);
  assert.match(webview.html, /data-command="login"/);
  assert.ok(infoMessages.includes('Logged out of OJ.'));
});
