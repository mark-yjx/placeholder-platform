import * as vscode from 'vscode';
import path from 'node:path';
import { ProblemDetail } from '../api/PracticeApiClient';
import {
  handleProblemDetailMessage,
  type ProblemDetailWebviewActions
} from './ProblemDetailActions';
import {
  createProblemDetailHtml as buildProblemDetailHtml,
  createProblemDetailViewModel as buildProblemDetailViewModel,
  type ProblemDetailViewModel
} from './ProblemDetailViewModel';

export class ProblemDetailWebviewProvider implements vscode.WebviewViewProvider {
  private currentProblem: ProblemDetail | null = null;
  private currentView: vscode.WebviewView | null = null;

  constructor(private readonly actions: ProblemDetailWebviewActions) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      await handleProblemDetailMessage(message, this.currentProblem, this.actions);
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
