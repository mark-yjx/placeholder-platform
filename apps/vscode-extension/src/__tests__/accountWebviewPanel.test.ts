import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';
import { ExtensionApiError } from '../errors/ExtensionErrorMapper';
import { AccountWebviewPanel } from '../ui/AccountWebviewPanel';

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

class FakePanel {
  readonly webview = new FakeWebview();
  revealCount = 0;
  private disposeListener: (() => unknown) | null = null;

  reveal(): void {
    this.revealCount += 1;
  }

  onDidDispose(listener: () => unknown) {
    this.disposeListener = listener;
    return { dispose: () => undefined };
  }

  dispose(): void {
    this.disposeListener?.();
  }
}

test('account webview panel login path remains functional', async () => {
  const panel = new FakePanel();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const infoMessages: string[] = [];
  const webviewPanel = new AccountWebviewPanel(
    new AuthCommands(new FakeAuthClient({ accessToken: 'student-token', role: 'student' }), tokenStore),
    tokenStore,
    {
      showInformationMessage: (message) => infoMessages.push(message),
      showErrorMessage: () => undefined
    },
    () => panel
  );

  webviewPanel.show();
  await panel.webview.dispatch({
    command: 'login',
    email: 'student@example.com',
    password: 'secret'
  });

  assert.equal(tokenStore.getAccessToken(), 'student-token');
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: 'student@example.com',
    role: 'student'
  });
  assert.match(panel.webview.html, /Logged in as <strong>student@example\.com<\/strong>/);
  assert.ok(infoMessages.some((message) => message.includes('Logged in as student@example.com')));
});

test('account webview panel reuses the existing panel when reopened', () => {
  const panel = new FakePanel();
  const webviewPanel = new AccountWebviewPanel(
    new AuthCommands(new FakeAuthClient({ accessToken: 'student-token', role: 'student' }), new SessionTokenStore()),
    new SessionTokenStore(),
    {
      showInformationMessage: () => undefined,
      showErrorMessage: () => undefined
    },
    () => panel
  );

  webviewPanel.show();
  webviewPanel.show();

  assert.equal(panel.revealCount, 1);
});

test('account webview panel reports friendly failed login errors', async () => {
  const panel = new FakePanel();
  const tokenStore = new SessionTokenStore(new FakeSecretStorage());
  const errorMessages: string[] = [];
  const webviewPanel = new AccountWebviewPanel(
    new AuthCommands(
      new FakeAuthClient(
        new ExtensionApiError(401, {
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'invalid credentials'
          }
        })
      ),
      tokenStore
    ),
    tokenStore,
    {
      showInformationMessage: () => undefined,
      showErrorMessage: (message) => errorMessages.push(message)
    },
    () => panel
  );

  webviewPanel.show();
  await panel.webview.dispatch({
    command: 'login',
    email: 'student@example.com',
    password: 'wrong-password'
  });

  assert.equal(tokenStore.isAuthenticated(), false);
  assert.match(panel.webview.html, /Invalid email or password\. Try again from the Account window\./);
  assert.deepEqual(errorMessages, ['Invalid email or password. Try again from the Account window.']);
});
