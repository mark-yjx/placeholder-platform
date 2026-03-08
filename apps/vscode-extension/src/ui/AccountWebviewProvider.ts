import * as vscode from 'vscode';
import { AuthCommands } from '../auth/AuthCommands';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createAccountHtml, createAccountViewModel } from './AccountViewModel';

type AccountWebviewMessage =
  | { command: 'login'; email?: unknown; password?: unknown }
  | { command: 'logout' }
  | { command: 'fetchProblems' };

type AccountWindowLike = Pick<typeof vscode.window, 'showErrorMessage' | 'showInformationMessage'>;

export class AccountWebviewProvider implements vscode.WebviewViewProvider {
  private currentView: vscode.WebviewView | null = null;
  private errorMessage: string | null = null;

  constructor(
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike,
    private readonly actions: {
      fetchProblems(): Promise<void>;
    }
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
      return;
    }

    await this.fetchProblems();
  }

  private async login(email: string, password: string): Promise<void> {
    try {
      const session = await this.authCommands.login({ email, password });
      this.errorMessage = null;
      this.render();
      const roleSuffix = session.role ? ` (${session.role})` : '';
      this.window.showInformationMessage(`Logged in as ${session.email ?? 'current user'}${roleSuffix}.`);
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

  private async fetchProblems(): Promise<void> {
    try {
      this.errorMessage = null;
      await this.actions.fetchProblems();
      this.render();
    } catch (error) {
      const mapped = mapExtensionError(error);
      this.errorMessage = mapped.userMessage;
      this.render();
      this.window.showErrorMessage(mapped.userMessage);
    }
  }

  private resolvePanelErrorMessage(error: unknown): string {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage === 'Invalid email' || rawMessage === 'Password is required') {
      return rawMessage;
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
      isAuthenticated: this.tokenStore.isAuthenticated(),
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
  return command === 'login' || command === 'logout' || command === 'fetchProblems';
}
