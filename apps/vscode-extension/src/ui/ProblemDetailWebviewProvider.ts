import * as vscode from 'vscode';
import path from 'node:path';
import { ProblemDetail } from '../api/PracticeApiClient';
import {
  createProblemDetailHtml as buildProblemDetailHtml,
  createProblemDetailViewModel as buildProblemDetailViewModel,
  type ProblemDetailViewModel
} from './ProblemDetailViewModel';

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

    this.currentView.webview.html = createDetailHtml(
      createProblemDetailViewModel(this.currentProblem)
    );
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

export function createProblemDetailViewModel(problem: ProblemDetail | null): ProblemDetailViewModel {
  return buildProblemDetailViewModel(
    problem,
    problem ? resolveStarterFilePath(problem.problemId) : null
  );
}

export function createDetailHtml(input: ProblemDetailViewModel): string {
  return buildProblemDetailHtml(input);
}
