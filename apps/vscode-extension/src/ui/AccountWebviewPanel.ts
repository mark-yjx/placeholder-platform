import * as vscode from 'vscode';
import { AuthCommands } from '../auth/AuthCommands';
import { BrowserAuthFlowLike } from '../auth/BrowserAuthFlow';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createAccountHtml, createAccountViewModel } from './AccountViewModel';

type AccountWebviewMessage =
  | { command: 'signIn' }
  | { command: 'signUp' }
  | { command: 'enterCode' }
  | { command: 'logout' };

export type AccountWebviewLike = {
  html: string;
  options?: {
    enableScripts?: boolean;
  };
  onDidReceiveMessage(listener: (message: unknown) => unknown): { dispose(): unknown };
};

export type AccountWebviewPanelLike = {
  webview: AccountWebviewLike;
  reveal(): void;
  onDidDispose(listener: () => unknown): { dispose(): unknown };
  dispose(): void;
};

type AccountWindowLike = Pick<typeof vscode.window, 'showErrorMessage' | 'showInformationMessage' | 'showInputBox'>;

export class AccountWebviewPanel {
  private currentPanel: AccountWebviewPanelLike | null = null;
  private errorMessage: string | null = null;

  constructor(
    private readonly browserAuthFlow: BrowserAuthFlowLike,
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike,
    private readonly createPanel: () => AccountWebviewPanelLike,
    private readonly onSessionChanged?: () => void
  ) {}

  show(): void {
    if (this.currentPanel) {
      this.currentPanel.reveal();
      this.render();
      return;
    }

    const panel = this.createPanel();
    this.currentPanel = panel;
    panel.webview.options = { enableScripts: true };
    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(message);
    });
    panel.onDidDispose(() => {
      this.currentPanel = null;
    });
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isAccountWebviewMessage(message)) {
      return;
    }

    if (message.command === 'signIn' || message.command === 'signUp') {
      await this.startBrowserAuth(message.command === 'signIn' ? 'sign-in' : 'sign-up');
      return;
    }

    if (message.command === 'enterCode') {
      await this.completeBrowserAuthFallback();
      return;
    }

    if (message.command === 'logout') {
      await this.logout();
    }
  }

  private async startBrowserAuth(mode: 'sign-in' | 'sign-up'): Promise<void> {
    try {
      this.errorMessage = null;
      await this.browserAuthFlow.start(mode);
      this.onSessionChanged?.();
      this.render();
    } catch (error) {
      const message = this.resolvePanelErrorMessage(error);
      this.errorMessage = message;
      this.render();
      this.window.showErrorMessage(message);
    }
  }

  private async logout(): Promise<void> {
    await this.authCommands.logout();
    this.errorMessage = null;
    this.onSessionChanged?.();
    this.render();
    this.window.showInformationMessage('Logged out of OJ.');
  }

  private async completeBrowserAuthFallback(): Promise<void> {
    try {
      this.errorMessage = null;
      const completed = await this.browserAuthFlow.enterFallbackCode();
      if (!completed) {
        return;
      }
      this.onSessionChanged?.();
      this.render();
    } catch (error) {
      const message = this.resolvePanelErrorMessage(error);
      this.errorMessage = message;
      this.render();
      this.window.showErrorMessage(message);
    }
  }

  private resolvePanelErrorMessage(error: unknown): string {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage === 'Invalid email' || rawMessage === 'Password is required') {
      return rawMessage;
    }
    if (rawMessage === 'Login succeeded but account details are incomplete.') {
      return 'Login failed because the account profile is incomplete. Try again or contact your instructor.';
    }

    return mapExtensionError(error).userMessage.replace(
      'Run OJ: Sign In and try again.',
      'Try again from the Account window.'
    );
  }

  private render(): void {
    if (!this.currentPanel) {
      return;
    }

    const session = this.tokenStore.getSessionIdentity();
    this.currentPanel.webview.html = createAccountHtml(
      createAccountViewModel({
        isAuthenticated: this.tokenStore.isAuthenticated() && isCompleteAccountIdentity(session),
        email: session.email,
        role: session.role,
        errorMessage: this.errorMessage
      })
    );
  }
}

function isAccountWebviewMessage(message: unknown): message is AccountWebviewMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }

  const command = (message as { command?: unknown }).command;
  return command === 'signIn' || command === 'signUp' || command === 'enterCode' || command === 'logout';
}

function isCompleteAccountIdentity(input: { email?: string | null; role?: string | null }): input is {
  email: string;
  role: string;
} {
  const email = input.email?.trim() ?? '';
  const role = input.role?.trim() ?? '';
  return Boolean(email && role);
}
