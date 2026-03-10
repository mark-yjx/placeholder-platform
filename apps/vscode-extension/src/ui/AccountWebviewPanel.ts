import * as vscode from 'vscode';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createAccountHtml, createAccountViewModel } from './AccountViewModel';

type AccountWebviewMessage =
  | { command: 'signIn' }
  | { command: 'signUp' }
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
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike,
    private readonly createPanel: () => AccountWebviewPanelLike,
    private readonly openExternalUrl: (url: string) => Promise<void>
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

    if (message.command === 'logout') {
      await this.logout();
    }
  }

  private async startBrowserAuth(mode: 'sign-in' | 'sign-up'): Promise<void> {
    try {
      await this.openExternalUrl(this.authCommands.getBrowserAuthUrl(mode));
      this.window.showInformationMessage(
        mode === 'sign-in'
          ? 'Student sign-in opened in your browser. Paste the one-time code here when you finish.'
          : 'Student sign-up opened in your browser. Paste the one-time code here when you finish.'
      );
      const code = await this.window.showInputBox({
        prompt:
          mode === 'sign-in'
            ? 'Paste the student sign-in code from your browser'
            : 'Paste the student sign-up code from your browser',
        placeHolder: 'Example: 8F2A9C4D10',
        ignoreFocusOut: true
      });
      if (code === undefined) {
        return;
      }

      const session = await this.authCommands.completeBrowserAuth(code);
      if (!isCompleteAccountIdentity(session)) {
        await this.authCommands.logout();
        throw new Error('Login succeeded but account details are incomplete.');
      }
      this.errorMessage = null;
      this.render();
      this.window.showInformationMessage(`Logged in as ${session.email} (${session.role}).`);
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
    this.render();
    this.window.showInformationMessage('Logged out of OJ.');
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
  return command === 'signIn' || command === 'signUp' || command === 'logout';
}

function isCompleteAccountIdentity(input: { email?: string | null; role?: string | null }): input is {
  email: string;
  role: string;
} {
  const email = input.email?.trim() ?? '';
  const role = input.role?.trim() ?? '';
  return Boolean(email && role);
}
