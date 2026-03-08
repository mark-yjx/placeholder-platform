import * as vscode from 'vscode';
import path from 'node:path';
import { ProblemDetail } from '../api/PracticeApiClient';
import { resolveProblemStatementMarkdown } from './PracticeViewState';

type ProblemDetailWebviewActions = {
  openStarterFile(problemId: string): Promise<void>;
  submitCurrentFile(): Promise<void>;
  refreshProblem(problemId: string): Promise<void>;
};

type WebviewMessage =
  | { command: 'openStarter' }
  | { command: 'submitCurrentFile' }
  | { command: 'refreshProblem' };

export class ProblemDetailWebviewProvider implements vscode.WebviewViewProvider {
  private currentProblem: ProblemDetail | null = null;
  private currentView: vscode.WebviewView | null = null;

  constructor(private readonly actions: ProblemDetailWebviewActions) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isWebviewMessage(message)) {
        return;
      }
      const problemId = this.currentProblem?.problemId;
      if (!problemId) {
        return;
      }
      if (message.command === 'openStarter') {
        await this.actions.openStarterFile(problemId);
        return;
      }
      if (message.command === 'submitCurrentFile') {
        await this.actions.submitCurrentFile();
        return;
      }
      if (message.command === 'refreshProblem') {
        await this.actions.refreshProblem(problemId);
      }
    });
  }

  showProblemDetail(problem: ProblemDetail): void {
    this.currentProblem = problem;
    this.render();
  }

  private render(): void {
    if (!this.currentView) {
      return;
    }

    const problem = this.currentProblem;
    this.currentView.webview.html = createDetailHtml({
      title: problem?.title ?? 'No problem selected',
      statement:
        (problem ? resolveProblemStatementMarkdown(problem) : null) ??
        'Select a problem from the Problems list to view details.',
      starterFilePath: problem ? resolveStarterFilePath(problem.problemId) : null
    });
  }
}

function isWebviewMessage(message: unknown): message is WebviewMessage {
  if (!message || typeof message !== 'object' || !('command' in message)) {
    return false;
  }
  const command = (message as { command?: unknown }).command;
  return command === 'openStarter' || command === 'submitCurrentFile' || command === 'refreshProblem';
}

function resolveStarterFilePath(problemId: string): string {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const relativePath = path.join('.oj', 'problems', `${problemId}.py`);
  if (!workspaceRoot) {
    return relativePath;
  }
  return path.join(workspaceRoot, relativePath);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createDetailHtml(input: {
  title: string;
  statement: string;
  starterFilePath: string | null;
}): string {
  const title = escapeHtml(input.title);
  const statement = escapeHtml(input.statement);
  const starterFilePath = escapeHtml(input.starterFilePath ?? 'No file path available yet.');

  return `<!doctype html>
<html lang="en">
  <body>
    <h2>${title}</h2>
    <p><strong>Starter:</strong> <code>${starterFilePath}</code></p>
    <div>
      <button data-command="openStarter">Open Starter</button>
      <button data-command="submitCurrentFile">Submit Current File</button>
      <button data-command="refreshProblem">Refresh</button>
    </div>
    <hr />
    <pre style="white-space: pre-wrap;">${statement}</pre>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}
