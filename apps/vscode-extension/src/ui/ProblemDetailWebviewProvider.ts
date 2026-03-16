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

export type ProblemDetailWebviewLike = {
  html: string;
  options?: {
    enableScripts?: boolean;
  };
  onDidReceiveMessage(listener: (message: unknown) => unknown): { dispose(): unknown };
};

export type ProblemDetailWebviewPanelLike = {
  webview: ProblemDetailWebviewLike;
  title?: string;
  reveal(): void;
  onDidDispose(listener: () => unknown): { dispose(): unknown };
  dispose(): void;
};

export class ProblemDetailWebviewPanel {
  private currentProblem: ProblemDetail | null = null;
  private currentPanel: ProblemDetailWebviewPanelLike | null = null;

  constructor(
    private readonly actions: ProblemDetailWebviewActions,
    private readonly createPanel: () => ProblemDetailWebviewPanelLike
  ) {}

  showProblemDetail(problem: ProblemDetail | null): void {
    this.currentProblem = problem;
    if (!this.currentPanel) {
      if (!problem) {
        return;
      }

      const panel = this.createPanel();
      this.currentPanel = panel;
      panel.webview.options = { enableScripts: true };
      panel.webview.onDidReceiveMessage(async (message: unknown) => {
        await handleProblemDetailMessage(message, this.currentProblem, this.actions);
      });
      panel.onDidDispose(() => {
        this.currentPanel = null;
      });
    } else if (problem) {
      this.currentPanel.reveal();
    }

    this.updatePanelTitle();
    this.render();
  }

  private updatePanelTitle(): void {
    if (!this.currentPanel) {
      return;
    }

    this.currentPanel.title = this.currentProblem?.title?.trim() || 'Problem Detail';
  }

  private render(): void {
    if (!this.currentPanel) {
      return;
    }

    this.currentPanel.webview.html = createDetailHtml(
      createProblemDetailViewModel(this.currentProblem)
    );
  }
}

function resolveWorkspaceRoot(): string | null {
  try {
    const vscode = require('vscode') as {
      workspace?: {
        workspaceFolders?: readonly {
          uri: {
            fsPath: string;
          };
        }[];
      };
    };
    return vscode.workspace?.workspaceFolders?.[0]?.uri.fsPath ?? null;
  } catch {
    return null;
  }
}

function resolveStarterFilePath(problemId: string): string {
  const workspaceRoot = resolveWorkspaceRoot();
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
