import * as vscode from 'vscode';
import { SubmissionResult } from '../api/PracticeApiClient';
import {
  createSubmissionDetailHtml,
  createSubmissionDetailViewModel,
  type SubmissionDetailViewModel as RenderedSubmissionDetailViewModel
} from './SubmissionDetailViewModel';

export type SubmissionDetailState = {
  submissionId: string;
  status: string;
  verdict?: SubmissionResult['verdict'];
  timeMs?: number;
  memoryKb?: number;
  failureInfo?: string;
  detail: string;
};

export class SubmissionDetailWebviewProvider implements vscode.WebviewViewProvider {
  private currentSubmission: SubmissionDetailState | null = null;
  private currentView: vscode.WebviewView | null = null;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    this.render();
  }

  showSubmissionDetail(submission: SubmissionDetailState): void {
    this.currentSubmission = submission;
    this.render();
  }

  private render(): void {
    if (!this.currentView) {
      return;
    }

    this.currentView.webview.html = createDetailHtml(this.currentSubmission);
  }
}

export function createDetailHtml(input: SubmissionDetailState | null): string {
  return createSubmissionDetailHtml(
    createSubmissionDetailViewModel(input) as RenderedSubmissionDetailViewModel
  );
}
