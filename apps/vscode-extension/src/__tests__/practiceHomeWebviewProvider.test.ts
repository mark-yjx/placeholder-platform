import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserAuthFlowLike, BrowserAuthUriLike } from '../auth/BrowserAuthFlow';
import { PracticeHomeWebviewProvider } from '../ui/PracticeHomeWebviewProvider';
import { createPracticeHomeHtml, createPracticeHomeViewModel } from '../ui/PracticeHomeViewModel';

class FakeBrowserAuthFlow implements BrowserAuthFlowLike {
  readonly startedModes: Array<'sign-in' | 'sign-up'> = [];

  async start(mode: 'sign-in' | 'sign-up'): Promise<void> {
    this.startedModes.push(mode);
  }

  async enterFallbackCode(): Promise<boolean> {
    return false;
  }

  async handleUri(_uri: BrowserAuthUriLike): Promise<void> {
    return;
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

test('practice home renders signed-out auth state in the sidebar', () => {
  const html = createPracticeHomeHtml(
    createPracticeHomeViewModel({
      isAuthenticated: false
    })
  );

  assert.match(html, /Placeholder Practice/);
  assert.match(html, /Solve problems directly in VS Code\./);
  assert.match(html, /Sign in to start practicing/);
  assert.match(html, /data-command="signIn"/);
  assert.match(html, /data-command="signUp"/);
  assert.doesNotMatch(html, /data-command="fetchProblems"/);
  assert.match(html, /Authentication opens in your browser and returns to VS Code automatically\./);
});

test('practice home renders no-problems state after sign-in', () => {
  const html = createPracticeHomeHtml(
    createPracticeHomeViewModel({
      isAuthenticated: true
    })
  );

  assert.match(html, /No problems loaded yet\./);
  assert.match(html, /Fetch problems to start practicing/);
  assert.match(html, /data-command="fetchProblems"/);
  assert.doesNotMatch(html, /data-command="signIn"/);
  assert.doesNotMatch(html, /data-command="signUp"/);
});

test('practice home provider keeps auth and fetch actions wired', async () => {
  const authFlow = new FakeBrowserAuthFlow();
  const webview = new FakeWebview();
  const fetchCalls: string[] = [];
  const provider = new PracticeHomeWebviewProvider(
    authFlow,
    {
      showErrorMessage: () => undefined
    },
    {
      fetchProblems: async () => {
        fetchCalls.push('fetch');
      }
    }
  );

  provider.resolveWebviewView({ webview } as never);
  provider.setState({ isAuthenticated: false });
  await webview.dispatch({ command: 'signIn' });
  await webview.dispatch({ command: 'signUp' });

  provider.setState({ isAuthenticated: true });
  await webview.dispatch({ command: 'fetchProblems' });

  assert.deepEqual(authFlow.startedModes, ['sign-in', 'sign-up']);
  assert.deepEqual(fetchCalls, ['fetch']);
});
