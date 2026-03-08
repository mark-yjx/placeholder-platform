import * as vscode from 'vscode';
import { ProblemDetail, PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';
import { PracticeViewState } from './PracticeViewState';

class ProblemsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly state: PracticeViewState) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<readonly vscode.TreeItem[]> {
    return this.state.getProblemNodes().map((problem) => {
      const item = new vscode.TreeItem(problem.label, vscode.TreeItemCollapsibleState.None);
      item.id = problem.id;
      item.description = problem.description;
      item.tooltip = problem.detail;
      item.command = {
        command: 'oj.practice.selectProblem',
        title: 'Open Problem Detail',
        arguments: [problem.id]
      };
      return item;
    });
  }
}

class SubmissionsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly state: PracticeViewState) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<readonly vscode.TreeItem[]> {
    return this.state.getSubmissionNodes().map((submission) => {
      const item = new vscode.TreeItem(submission.label, vscode.TreeItemCollapsibleState.None);
      item.id = submission.id;
      item.description = submission.description;
      item.tooltip = submission.detail;
      item.command = {
        command: 'oj.practice.selectSubmission',
        title: 'Show Submission Detail',
        arguments: [submission.id]
      };
      return item;
    });
  }
}

class AccountTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<readonly vscode.TreeItem[]> {
    const loginItem = new vscode.TreeItem('Login', vscode.TreeItemCollapsibleState.None);
    loginItem.id = 'account-login';
    loginItem.description = 'Authenticate with OJ';
    loginItem.command = {
      command: 'oj.login',
      title: 'OJ: Login'
    };

    return [loginItem];
  }
}

export class PracticeTreeViews {
  private readonly state = new PracticeViewState();
  private readonly problemsProvider = new ProblemsTreeDataProvider(this.state);
  private readonly submissionsProvider = new SubmissionsTreeDataProvider(this.state);
  private readonly accountProvider = new AccountTreeDataProvider();
  private selectedSubmissionId: string | null = null;

  constructor(
    private readonly window: Pick<typeof vscode.window, 'showInformationMessage' | 'showTextDocument'>,
    private readonly workspace: Pick<typeof vscode.workspace, 'openTextDocument'>,
    private readonly onProblemDetailChanged?: (problem: ProblemDetail) => void,
    private readonly onSubmissionDetailChanged?: (submission: {
      submissionId: string;
      statusSummary: string;
      detail: string;
    }) => void
  ) {}

  register(registerTreeDataProvider: (viewId: string, provider: vscode.TreeDataProvider<vscode.TreeItem>) => vscode.Disposable): readonly vscode.Disposable[] {
    return [
      registerTreeDataProvider('ojProblems', this.problemsProvider),
      registerTreeDataProvider('ojSubmissions', this.submissionsProvider),
      registerTreeDataProvider('ojAccount', this.accountProvider)
    ];
  }

  showProblems(problems: readonly PublishedProblem[]): void {
    this.state.setProblems(problems);
    this.problemsProvider.refresh();
  }

  showProblemDetail(problem: ProblemDetail): void {
    this.state.showProblemDetail(problem);
    this.onProblemDetailChanged?.(problem);
    this.problemsProvider.refresh();
  }

  setSelectedProblem(problemId: string): void {
    this.state.setSelectedProblem(problemId);
  }

  getSelectedProblemId(): string | null {
    return this.state.getSelectedProblemId();
  }

  showSubmissionCreated(submissionId: string): void {
    this.state.recordSubmissionCreated(submissionId);
    this.submissionsProvider.refresh();
    if (this.selectedSubmissionId === submissionId) {
      this.emitSubmissionDetail(submissionId);
    }
  }

  showSubmissionResult(result: SubmissionResult): void {
    this.state.recordSubmissionResult(result);
    this.submissionsProvider.refresh();
    if (this.selectedSubmissionId === result.submissionId) {
      this.emitSubmissionDetail(result.submissionId);
    }
  }

  revealSubmission(submissionId: string): void {
    this.selectedSubmissionId = submissionId;
    this.emitSubmissionDetail(submissionId);
    const detail = this.state.getSubmissionDetail(submissionId);
    if (detail) {
      this.window.showInformationMessage(detail);
    }
  }

  private emitSubmissionDetail(submissionId: string): void {
    const node = this.state.getSubmissionNodes().find((candidate) => candidate.id === submissionId);
    if (!node) {
      return;
    }

    this.onSubmissionDetailChanged?.({
      submissionId,
      statusSummary: node.description,
      detail: node.detail
    });
  }

  async revealProblem(problemId: string): Promise<void> {
    const detail = this.state.getProblemDetail(problemId);
    if (!detail) {
      return;
    }
    const document = await this.workspace.openTextDocument({
      content: detail,
      language: 'markdown'
    });
    await this.window.showTextDocument(document, { preview: true });
  }
}
