import * as vscode from 'vscode';
import { BrowserAuthFlowLike } from '../auth/BrowserAuthFlow';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createPracticeHomeHtml, createPracticeHomeViewModel } from './PracticeHomeViewModel';

type PracticeHomeMessage =
  | { command: 'signIn' }
  | { command: 'signUp' }
  | { command: 'fetchProblems' };

type PracticeHomeWindowLike = Pick<typeof vscode.window, 'showErrorMessage'>;

export class PracticeHomeWebviewProvider implements vscode.WebviewViewProvider {
  private currentView: vscode.WebviewView | null = null;
  private isAuthenticated = false;
  private errorMessage: string | null = null;

  constructor(
    private readonly browserAuthFlow: BrowserAuthFlowLike,
    private readonly window: PracticeHomeWindowLike,
    private readonly actions: {
      fetchProblems: () => Promise<void>;
    },
    private readonly onSessionChanged?: () => void
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(message);
    });
  }

  setState(input: { isAuthenticated: boolean }): void {
    this.isAuthenticated = input.isAuthenticated;
    this.render();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isPracticeHomeMessage(message)) {
      return;
    }

    if (message.command === 'signIn' || message.command === 'signUp') {
      await this.startBrowserAuth(message.command === 'signIn' ? 'sign-in' : 'sign-up');
      return;
    }

    if (message.command === 'fetchProblems') {
      await this.fetchProblems();
    }
  }

  private async startBrowserAuth(mode: 'sign-in' | 'sign-up'): Promise<void> {
    try {
      this.errorMessage = null;
      await this.browserAuthFlow.start(mode);
      this.onSessionChanged?.();
      this.render();
    } catch (error) {
      const message = mapExtensionError(error).userMessage.replace(
        'Run OJ: Sign In and try again.',
        'Try again from the OJ sidebar.'
      );
      this.errorMessage = message;
      this.render();
      this.window.showErrorMessage(message);
    }
  }

  private async fetchProblems(): Promise<void> {
    try {
      this.errorMessage = null;
      await this.actions.fetchProblems();
      this.render();
    } catch (error) {
      const message = mapExtensionError(error).userMessage;
      this.errorMessage = message;
      this.render();
      this.window.showErrorMessage(message);
    }
  }

  private render(): void {
    if (!this.currentView) {
      return;
    }

    this.currentView.webview.html = createPracticeHomeHtml(
      createPracticeHomeViewModel({
        isAuthenticated: this.isAuthenticated,
        errorMessage: this.errorMessage
      })
    );
  }
}

function isPracticeHomeMessage(message: unknown): message is PracticeHomeMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }

  const command = (message as { command?: unknown }).command;
  return command === 'signIn' || command === 'signUp' || command === 'fetchProblems';
}
