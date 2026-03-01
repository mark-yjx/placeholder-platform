import * as vscode from 'vscode';
import { EngagementCommands } from './engagement/EngagementCommands';
import { registerExtensionCommands } from './extensionCore';
import { AuthCommands } from './auth/AuthCommands';
import { SessionTokenStore } from './auth/SessionTokenStore';
import { PracticeCommands } from './practice/PracticeCommands';
import {
  OJ_CONFIGURATION_NAMESPACE,
  resolveApiBaseUrl
} from './config/ExtensionConfiguration';
import {
  InMemoryAuthClient,
  InMemoryEngagementApiClient,
  InMemoryPracticeApiClient
} from './runtime/InMemoryExtensionClients';
import { PracticeTreeViews } from './ui/PracticeTreeViews';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('OJ VSCode');
  output.show(true);
  const apiBaseUrl = resolveApiBaseUrl(vscode.workspace.getConfiguration(OJ_CONFIGURATION_NAMESPACE));
  const tokenStore = new SessionTokenStore(context.secrets);
  await tokenStore.hydrate();
  const clientConfig = { apiBaseUrl };

  const authCommands = new AuthCommands(new InMemoryAuthClient(clientConfig), tokenStore);
  const practiceCommands = new PracticeCommands(new InMemoryPracticeApiClient(clientConfig), tokenStore);
  const engagementCommands = new EngagementCommands(new InMemoryEngagementApiClient(clientConfig), tokenStore);
  const practiceViews = new PracticeTreeViews(vscode.window);

  const disposables = registerExtensionCommands({
    authCommands,
    practiceCommands,
    engagementCommands,
    practiceViews,
    output,
    window: vscode.window,
    registerCommand: (commandId, callback) => vscode.commands.registerCommand(commandId, callback)
  });
  const treeViewDisposables = practiceViews.register((viewId, provider) =>
    vscode.window.registerTreeDataProvider(viewId, provider)
  );
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
  for (const disposable of disposables) {
    context.subscriptions.push(disposable);
  }
  for (const disposable of treeViewDisposables) {
    context.subscriptions.push(disposable);
  }
  context.subscriptions.push(revealSubmissionDisposable);

  output.appendLine('OJ VSCode extension activated');
  output.appendLine(`API base URL: ${apiBaseUrl}`);
  if (tokenStore.isAuthenticated()) {
    output.appendLine('Session restored from SecretStorage');
  }
}

export function deactivate(): void {
  return;
}
