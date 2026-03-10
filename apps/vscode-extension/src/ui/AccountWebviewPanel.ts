import * as vscode from 'vscode';
import {
  LeaderboardScope,
  LeaderboardView,
  StudentStatsView
} from '../api/EngagementApiClient';
import { SubmissionResult } from '../api/PracticeApiClient';
import { AuthCommands } from '../auth/AuthCommands';
import { BrowserAuthFlowLike, BrowserAuthUriLike } from '../auth/BrowserAuthFlow';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';
import { createAccountHtml, createAccountViewModel } from './AccountViewModel';

type AccountWebviewMessage =
  | { command: 'signIn' }
  | { command: 'signUp' }
  | { command: 'enterCode' }
  | { command: 'logout' }
  | { command: 'selectLeaderboardScope'; scope?: unknown };

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

type AccountStatsLoader = {
  getMyStats: () => Promise<StudentStatsView>;
  getLeaderboard: (scope: LeaderboardScope) => Promise<LeaderboardView>;
  listSubmissions: () => Promise<readonly SubmissionResult[]>;
};

const LEADERBOARD_SCOPES: readonly LeaderboardScope[] = ['all-time', 'weekly', 'monthly', 'streak'];

export class AccountWebviewPanel {
  private currentPanel: AccountWebviewPanelLike | null = null;
  private errorMessage: string | null = null;
  private statsErrorMessage: string | null = null;
  private isLoadingStats = false;
  private stats: StudentStatsView | null = null;
  private leaderboards: Partial<Record<LeaderboardScope, LeaderboardView>> = {};
  private selectedLeaderboardScope: LeaderboardScope = 'all-time';
  private recentSubmissions: readonly SubmissionResult[] = [];
  private statsLoadId = 0;

  constructor(
    private readonly browserAuthFlow: BrowserAuthFlowLike,
    private readonly authCommands: AuthCommands,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountWindowLike,
    private readonly createPanel: () => AccountWebviewPanelLike,
    private readonly onSessionChanged?: () => void,
    private readonly statsLoader?: AccountStatsLoader
  ) {}

  show(): void {
    if (this.currentPanel) {
      this.currentPanel.reveal();
      this.render();
      void this.loadStatsAndRender();
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
    void this.loadStatsAndRender();
  }

  refresh(): void {
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
      return;
    }

    if (message.command === 'selectLeaderboardScope' && isLeaderboardScope(message.scope)) {
      this.selectedLeaderboardScope = message.scope;
      this.render();
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
      'Try again from the Account window.'
    );
  }

  private async loadStatsAndRender(): Promise<void> {
    const session = this.tokenStore.getSessionIdentity();
    const isAuthenticated = this.tokenStore.isAuthenticated() && isCompleteAccountIdentity(session);
    const loadId = ++this.statsLoadId;
    const statsLoader = this.statsLoader;

    if (!isAuthenticated || !statsLoader) {
      this.resetStatsState();
      this.render();
      return;
    }

    this.isLoadingStats = true;
    this.statsErrorMessage = null;
    this.render();

    try {
      const [stats, leaderboardEntries, recentSubmissions] = await Promise.all([
        statsLoader.getMyStats(),
        Promise.all(
          LEADERBOARD_SCOPES.map(async (scope) => [scope, await statsLoader.getLeaderboard(scope)] as const)
        ),
        statsLoader.listSubmissions()
      ]);
      if (loadId !== this.statsLoadId) {
        return;
      }
      this.stats = stats;
      this.leaderboards = Object.fromEntries(leaderboardEntries) as Partial<
        Record<LeaderboardScope, LeaderboardView>
      >;
      this.recentSubmissions = recentSubmissions;
    } catch (error) {
      if (loadId !== this.statsLoadId) {
        return;
      }
      this.stats = null;
      this.leaderboards = {};
      this.recentSubmissions = [];
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
    this.leaderboards = {};
    this.selectedLeaderboardScope = 'all-time';
    this.recentSubmissions = [];
    this.statsErrorMessage = null;
    this.isLoadingStats = false;
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
        errorMessage: this.errorMessage,
        statsErrorMessage: this.statsErrorMessage,
        isLoadingStats: this.isLoadingStats,
        stats: this.stats,
        leaderboards: this.leaderboards,
        selectedLeaderboardScope: this.selectedLeaderboardScope,
        recentSubmissions: this.recentSubmissions
      })
    );
  }
}

function isAccountWebviewMessage(message: unknown): message is AccountWebviewMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }

  const command = (message as { command?: unknown }).command;
  return (
    command === 'signIn' ||
    command === 'signUp' ||
    command === 'enterCode' ||
    command === 'logout' ||
    command === 'selectLeaderboardScope'
  );
}

function isCompleteAccountIdentity(input: { email?: string | null; role?: string | null }): input is {
  email: string;
  role: string;
} {
  const email = input.email?.trim() ?? '';
  const role = input.role?.trim() ?? '';
  return Boolean(email && role);
}

function isLeaderboardScope(value: unknown): value is LeaderboardScope {
  return value === 'all-time' || value === 'weekly' || value === 'monthly' || value === 'streak';
}

export type AccountBrowserAuthFlowLike = BrowserAuthFlowLike & {
  handleUri?: (uri: BrowserAuthUriLike) => Promise<void>;
};
