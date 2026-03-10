import * as vscode from 'vscode';
import { LeaderboardView, StudentStatsView } from '../api/EngagementApiClient';
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

type AccountWindowLike = Pick<typeof vscode.window, 'showErrorMessage' | 'showInformationMessage' | 'showInputBox'>;

type AccountStatsLoader = {
  getMyStats: () => Promise<StudentStatsView>;
  getLeaderboard: (scope: 'all-time') => Promise<LeaderboardView>;
};

export class AccountWebviewProvider implements vscode.WebviewViewProvider {
  private currentView: vscode.WebviewView | null = null;
  private errorMessage: string | null = null;
  private statsErrorMessage: string | null = null;
  private isLoadingStats = false;
  private stats: StudentStatsView | null = null;
  private leaderboard: LeaderboardView | null = null;
  private statsLoadId = 0;

  constructor(
    private readonly browserAuthFlow: BrowserAuthFlowLike,
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike,
    private readonly onSessionChanged?: () => void,
    private readonly statsLoader?: AccountStatsLoader
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();
    void this.loadStatsAndRender();

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(message);
    });
  }

  refresh(): void {
    this.errorMessage = null;
    void this.loadStatsAndRender();
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
      await this.loadStatsAndRender();
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
    this.resetStatsState();
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
      await this.loadStatsAndRender();
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
      'Try again from the Account panel.'
    );
  }

  private async loadStatsAndRender(): Promise<void> {
    const session = this.tokenStore.getSessionIdentity();
    const isAuthenticated = this.tokenStore.isAuthenticated() && isCompleteAccountIdentity(session);
    const loadId = ++this.statsLoadId;

    if (!isAuthenticated || !this.statsLoader) {
      this.resetStatsState();
      this.render();
      return;
    }

    this.isLoadingStats = true;
    this.statsErrorMessage = null;
    this.render();

    try {
      const [stats, leaderboard] = await Promise.all([
        this.statsLoader.getMyStats(),
        this.statsLoader.getLeaderboard('all-time')
      ]);
      if (loadId !== this.statsLoadId) {
        return;
      }
      this.stats = stats;
      this.leaderboard = leaderboard;
    } catch (error) {
      if (loadId !== this.statsLoadId) {
        return;
      }
      this.stats = null;
      this.leaderboard = null;
      this.statsErrorMessage = mapExtensionError(error).userMessage;
    } finally {
      if (loadId !== this.statsLoadId) {
        return;
      }
      this.isLoadingStats = false;
      this.render();
    }
  }

  private resetStatsState(): void {
    this.stats = null;
    this.leaderboard = null;
    this.statsErrorMessage = null;
    this.isLoadingStats = false;
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
      errorMessage: this.errorMessage,
      statsErrorMessage: this.statsErrorMessage,
      isLoadingStats: this.isLoadingStats,
      stats: this.stats,
      leaderboard: this.leaderboard
    });
  }
}

export function createDetailHtml(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  errorMessage?: string | null;
  statsErrorMessage?: string | null;
  isLoadingStats?: boolean;
  stats?: StudentStatsView | null;
  leaderboard?: LeaderboardView | null;
}): string {
  return createAccountHtml(createAccountViewModel(input));
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
