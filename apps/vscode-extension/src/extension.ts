import * as vscode from 'vscode';
import { EngagementCommands } from './engagement/EngagementCommands';
import { registerExtensionCommands } from './extensionCore';
import { AuthCommands } from './auth/AuthCommands';
import { BrowserAuthFlow, createStudentAuthCallbackUri } from './auth/BrowserAuthFlow';
import { SessionTokenStore } from './auth/SessionTokenStore';
import { PracticeCommands } from './practice/PracticeCommands';
import {
  describeTokenStorageBehavior,
  DEFAULT_OJ_REQUEST_TIMEOUT_MS,
  OJ_CONFIGURATION_NAMESPACE,
  resolveApiBaseUrl,
  resolveRequestTimeoutMs,
  validateApiBaseUrl
} from './config/ExtensionConfiguration';
import {
  HttpAuthClient,
  HttpEngagementApiClient,
  HttpPracticeApiClient
} from './runtime/HttpExtensionClients';
import { restorePracticeStateOnStartup } from './runtime/ExtensionRuntimeBootstrap';
import { LocalPracticeStateStore } from './runtime/LocalPracticeStateStore';
import { ProblemStarterWorkspace } from './ui/ProblemStarterWorkspace';
import { PracticeTreeViews } from './ui/PracticeTreeViews';
import { ProblemDetailWebviewProvider } from './ui/ProblemDetailWebviewProvider';
import { SubmissionDetailWebviewProvider } from './ui/SubmissionDetailWebviewProvider';
import { AccountStatusBarController } from './ui/AccountStatusBarController';
import { AccountWebviewPanel } from './ui/AccountWebviewPanel';
import { PracticeHomeWebviewProvider } from './ui/PracticeHomeWebviewProvider';

const PRACTICE_HOME_VISIBLE_CONTEXT = 'oj.practice.homeVisible';
const PRACTICE_VIEWS_READY_CONTEXT = 'oj.practice.viewsReady';

function hasCompleteStudentIdentity(tokenStore: SessionTokenStore): boolean {
  const session = tokenStore.getSessionIdentity();
  return Boolean(
    tokenStore.isAuthenticated() &&
      session.email?.trim() &&
      session.role?.trim() &&
      session.role === 'student'
  );
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('OJ VSCode');
  output.show(true);
  const configuration = vscode.workspace.getConfiguration(OJ_CONFIGURATION_NAMESPACE);
  let apiBaseUrl: string;
  let requestTimeoutMs: number;

  try {
    apiBaseUrl = validateApiBaseUrl(resolveApiBaseUrl(configuration));
    requestTimeoutMs = resolveRequestTimeoutMs(configuration);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Extension configuration error: ${message}`);
    output.appendLine(`Default timeout remains ${DEFAULT_OJ_REQUEST_TIMEOUT_MS}ms when configuration is valid.`);
    vscode.window.showErrorMessage(message);
    return;
  }

  const tokenStore = new SessionTokenStore(context.secrets);
  await tokenStore.hydrate();
  const clientConfig = { apiBaseUrl, requestTimeoutMs };

  const authCommands = new AuthCommands(new HttpAuthClient(clientConfig), tokenStore);
  const practiceCommands = new PracticeCommands(new HttpPracticeApiClient(clientConfig), tokenStore);
  const engagementCommands = new EngagementCommands(new HttpEngagementApiClient(clientConfig), tokenStore);
  const problemDetailProvider = new ProblemDetailWebviewProvider({
    openStarterFile: async (problemId) => {
      await vscode.commands.executeCommand('oj.practice.openProblemStarter', problemId);
    },
    runPublicTests: async (problemId) => {
      await vscode.commands.executeCommand('oj.practice.runPublicTests', problemId);
    },
    submitCurrentFile: async () => {
      await vscode.commands.executeCommand('oj.practice.submitCurrentFile');
    },
    refreshProblem: async (problemId) => {
      await vscode.commands.executeCommand('oj.practice.fetchProblems');
      await vscode.commands.executeCommand('oj.practice.selectProblem', problemId);
    }
  });
  const submissionDetailProvider = new SubmissionDetailWebviewProvider();
  const accountStatusBar = new AccountStatusBarController(
    vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  );
  let accountPanel: AccountWebviewPanel | null = null;
  let sidebarHomeProvider: PracticeHomeWebviewProvider | null = null;
  let practiceViews: PracticeTreeViews | null = null;
  const updateSidebarContexts = async () => {
    const isAuthenticated = hasCompleteStudentIdentity(tokenStore);
    const hasLoadedProblems = practiceViews?.hasLoadedProblems() ?? false;
    sidebarHomeProvider?.setState({ isAuthenticated });
    await vscode.commands.executeCommand(
      'setContext',
      PRACTICE_HOME_VISIBLE_CONTEXT,
      !isAuthenticated || !hasLoadedProblems
    );
    await vscode.commands.executeCommand(
      'setContext',
      PRACTICE_VIEWS_READY_CONTEXT,
      isAuthenticated && hasLoadedProblems
    );
  };
  const refreshAccountStatus = () => {
    const session = tokenStore.getSessionIdentity();
    accountStatusBar.refresh({
      isAuthenticated: tokenStore.isAuthenticated(),
      email: session.email
    });
  };
  const refreshStudentUi = () => {
    if (!hasCompleteStudentIdentity(tokenStore)) {
      practiceViews?.clearAll();
    }
    accountPanel?.refresh();
    refreshAccountStatus();
    void updateSidebarContexts();
  };
  const browserAuthFlow = new BrowserAuthFlow(
    authCommands,
    vscode.window,
    async (url) => {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    },
    () => createStudentAuthCallbackUri(vscode.env.uriScheme),
    {
      output,
      stateStore: context.globalState,
      onSessionChanged: refreshStudentUi
    }
  );
  sidebarHomeProvider = new PracticeHomeWebviewProvider(
    browserAuthFlow,
    vscode.window,
    {
      fetchProblems: async () => {
        await vscode.commands.executeCommand('oj.practice.fetchProblems');
      }
    },
    refreshStudentUi
  );
  accountPanel = new AccountWebviewPanel(
    browserAuthFlow,
    authCommands,
    tokenStore,
    vscode.window,
    () =>
      vscode.window.createWebviewPanel('ojAccountPanel', 'OJ Account', vscode.ViewColumn.Beside, {
        enableScripts: true
      }),
    refreshStudentUi,
    {
      getMyStats: () => engagementCommands.getMyStats(),
      getLeaderboard: (scope) => engagementCommands.getLeaderboard(scope),
      listSubmissions: () => practiceCommands.listSubmissions()
    }
  );
  practiceViews = new PracticeTreeViews(
    vscode.window,
    vscode.workspace,
    (problemDetail) => problemDetailProvider.showProblemDetail(problemDetail),
    (submission) => submissionDetailProvider.showSubmissionDetail(submission),
    () => {
      void updateSidebarContexts();
    }
  );
  const problemStarterWorkspace = new ProblemStarterWorkspace(vscode.window, vscode.workspace);
  const localStateStore = new LocalPracticeStateStore(context.workspaceState);

  const disposables = registerExtensionCommands({
    authCommands,
    browserAuthFlow,
    practiceCommands,
    engagementCommands,
    practiceViews,
    problemStarterWorkspace,
    localStateStore,
    onAuthSessionChanged: () => {
      refreshStudentUi();
    },
    output,
    openExternalUrl: async (url) => {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    },
    window: vscode.window,
    registerCommand: (commandId, callback) => vscode.commands.registerCommand(commandId, callback)
  });
  const treeViewDisposables = practiceViews.register((viewId, provider) =>
    vscode.window.registerTreeDataProvider(viewId, provider)
  );
  const sidebarHomeDisposable = vscode.window.registerWebviewViewProvider(
    'ojPracticeHome',
    sidebarHomeProvider
  );
  const problemDetailPanelDisposable = vscode.window.registerWebviewViewProvider(
    'ojProblemDetail',
    problemDetailProvider
  );
  const submissionDetailPanelDisposable = vscode.window.registerWebviewViewProvider(
    'ojSubmissionDetail',
    submissionDetailProvider
  );
  const accountPanelDisposable = vscode.commands.registerCommand(
    AccountStatusBarController.commandId,
    async () => {
      accountPanel.show();
    }
  );
  const logoutDisposable = vscode.commands.registerCommand('oj.logout', async () => {
    await authCommands.logout();
    refreshStudentUi();
    vscode.window.showInformationMessage('Logged out of OJ.');
  });
  const revealSubmissionDisposable = vscode.commands.registerCommand(
    'oj.practice.selectSubmission',
    (...args: unknown[]) => {
      const submissionId = typeof args[0] === 'string' ? args[0] : '';
      if (!submissionId) {
        return;
      }
      practiceViews.revealSubmission(submissionId);
    }
  );

  context.subscriptions.push(output);
  context.subscriptions.push(accountStatusBar);
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        await browserAuthFlow.handleUri(uri);
      }
    })
  );
  for (const disposable of disposables) {
    context.subscriptions.push(disposable);
  }
  for (const disposable of treeViewDisposables) {
    context.subscriptions.push(disposable);
  }
  context.subscriptions.push(revealSubmissionDisposable);
  context.subscriptions.push(sidebarHomeDisposable);
  context.subscriptions.push(problemDetailPanelDisposable);
  context.subscriptions.push(submissionDetailPanelDisposable);
  context.subscriptions.push(accountPanelDisposable);
  context.subscriptions.push(logoutDisposable);

  output.appendLine('OJ VSCode extension activated');
  output.appendLine(`API base URL: ${apiBaseUrl}`);
  output.appendLine(`Request timeout: ${requestTimeoutMs}ms`);
  output.appendLine(describeTokenStorageBehavior());
  refreshAccountStatus();
  await updateSidebarContexts();
  await restorePracticeStateOnStartup({
    apiBaseUrl,
    tokenStore,
    practiceCommands,
    practiceViews,
    output,
    localStateStore,
    problemStarterWorkspace
  });
  await updateSidebarContexts();
}

export function deactivate(): void {
  return;
}
