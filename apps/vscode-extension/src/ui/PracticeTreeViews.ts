import * as vscode from 'vscode';
import { PublishedProblem, SubmissionResult } from '../api/PracticeApiClient';
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

export class PracticeTreeViews {
  private readonly state = new PracticeViewState();
  private readonly problemsProvider = new ProblemsTreeDataProvider(this.state);
  private readonly submissionsProvider = new SubmissionsTreeDataProvider(this.state);

  constructor(
    private readonly window: Pick<typeof vscode.window, 'showInformationMessage' | 'showTextDocument'>,
    private readonly workspace: Pick<typeof vscode.workspace, 'openTextDocument'>
  ) {}

  register(registerTreeDataProvider: (viewId: string, provider: vscode.TreeDataProvider<vscode.TreeItem>) => vscode.Disposable): readonly vscode.Disposable[] {
    return [
      registerTreeDataProvider('ojProblems', this.problemsProvider),
      registerTreeDataProvider('ojSubmissions', this.submissionsProvider)
    ];
  }

  showProblems(problems: readonly PublishedProblem[]): void {
    this.state.setProblems(problems);
    this.problemsProvider.refresh();
  }

  showSubmissionCreated(submissionId: string): void {
    this.state.recordSubmissionCreated(submissionId);
    this.submissionsProvider.refresh();
  }

  showSubmissionResult(result: SubmissionResult): void {
    this.state.recordSubmissionResult(result);
    this.submissionsProvider.refresh();
  }

  revealSubmission(submissionId: string): void {
    const detail = this.state.getSubmissionDetail(submissionId);
    if (detail) {
      this.window.showInformationMessage(detail);
    }
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
