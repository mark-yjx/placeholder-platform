import * as vscode from 'vscode';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createAccountHtml, createAccountViewModel } from './AccountViewModel';

type AccountWebviewMessage =
  | { command: 'login'; email?: unknown; password?: unknown }
  | { command: 'logout' };

type AccountWindowLike = Pick<typeof vscode.window, 'showErrorMessage' | 'showInformationMessage'>;

export class AccountWebviewProvider implements vscode.WebviewViewProvider {
  private currentView: vscode.WebviewView | null = null;
  private errorMessage: string | null = null;

  constructor(
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(message);
    });
  }

  refresh(): void {
    this.errorMessage = null;
    this.render();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isAccountWebviewMessage(message)) {
      return;
    }

    if (message.command === 'login') {
      const email = typeof message.email === 'string' ? message.email : '';
      const password = typeof message.password === 'string' ? message.password : '';
      await this.login(email, password);
      return;
    }

    if (message.command === 'logout') {
      await this.logout();
    }
  }

  private async login(email: string, password: string): Promise<void> {
    try {
      const session = await this.authCommands.login({ email, password });
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
      'Run OJ: Login and try again.',
      'Try again from the Account panel.'
    );
  }

  private render(): void {
    if (!this.currentView) {
      return;
    }

    const session = this.tokenStore.getSessionIdentity();
    this.currentView.webview.html = createDetailHtml({
      isAuthenticated: this.tokenStore.isAuthenticated() && isCompleteAccountIdentity(session),
      email: session.email,
      role: session.role,
      errorMessage: this.errorMessage
    });
  }
}

export function createDetailHtml(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  errorMessage?: string | null;
}): string {
  return createAccountHtml(createAccountViewModel(input));
}

function isAccountWebviewMessage(message: unknown): message is AccountWebviewMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }

  const command = (message as { command?: unknown }).command;
  return command === 'login' || command === 'logout';
}

function isCompleteAccountIdentity(input: { email?: string | null; role?: string | null }): input is {
  email: string;
  role: string;
} {
  const email = input.email?.trim() ?? '';
  const role = input.role?.trim() ?? '';
  return Boolean(email && role);
}
