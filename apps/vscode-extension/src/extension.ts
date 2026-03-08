import * as vscode from 'vscode';
import { EngagementCommands } from './engagement/EngagementCommands';
import { registerExtensionCommands } from './extensionCore';
import { AuthCommands } from './auth/AuthCommands';
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
    submitCurrentFile: async () => {
      await vscode.commands.executeCommand('oj.practice.submitCurrentFile');
    },
    refreshProblem: async (problemId) => {
      await vscode.commands.executeCommand('oj.practice.fetchProblems');
      await vscode.commands.executeCommand('oj.practice.selectProblem', problemId);
    }
  });
  const submissionDetailProvider = new SubmissionDetailWebviewProvider();
  const accountPanel = new AccountWebviewPanel(authCommands, tokenStore, vscode.window, () =>
    vscode.window.createWebviewPanel('ojAccountPanel', 'OJ Account', vscode.ViewColumn.Beside, {
      enableScripts: true
    })
  );
  const accountStatusBar = new AccountStatusBarController(
    vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  );
  const practiceViews = new PracticeTreeViews(
    vscode.window,
    vscode.workspace,
    (problemDetail) => problemDetailProvider.showProblemDetail(problemDetail),
    (submission) => submissionDetailProvider.showSubmissionDetail(submission)
  );
  const problemStarterWorkspace = new ProblemStarterWorkspace(vscode.window, vscode.workspace);
  const localStateStore = new LocalPracticeStateStore(context.workspaceState);

  const disposables = registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    practiceViews,
    problemStarterWorkspace,
    localStateStore,
    onAuthSessionChanged: () => {
      accountPanel.refresh();
      accountStatusBar.refresh();
    },
    output,
    window: vscode.window,
    registerCommand: (commandId, callback) => vscode.commands.registerCommand(commandId, callback)
  });
  const treeViewDisposables = practiceViews.register((viewId, provider) =>
    vscode.window.registerTreeDataProvider(viewId, provider)
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
    accountPanel.refresh();
    accountStatusBar.refresh();
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
  for (const disposable of disposables) {
    context.subscriptions.push(disposable);
  }
  for (const disposable of treeViewDisposables) {
    context.subscriptions.push(disposable);
  }
  context.subscriptions.push(revealSubmissionDisposable);
  context.subscriptions.push(problemDetailPanelDisposable);
  context.subscriptions.push(submissionDetailPanelDisposable);
  context.subscriptions.push(accountPanelDisposable);
  context.subscriptions.push(logoutDisposable);

  output.appendLine('OJ VSCode extension activated');
  output.appendLine(`API base URL: ${apiBaseUrl}`);
  output.appendLine(`Request timeout: ${requestTimeoutMs}ms`);
  output.appendLine(describeTokenStorageBehavior());
  accountStatusBar.refresh();
  await restorePracticeStateOnStartup({
    apiBaseUrl,
    tokenStore,
    practiceCommands,
    practiceViews,
    output,
    localStateStore,
    problemStarterWorkspace
  });
}

export function deactivate(): void {
  return;
}
