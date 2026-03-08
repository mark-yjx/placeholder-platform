import * as vscode from 'vscode';

export type SubmissionDetailViewModel = {
  submissionId: string;
  statusSummary: string;
  detail: string;
};

export class SubmissionDetailWebviewProvider implements vscode.WebviewViewProvider {
  private currentSubmission: SubmissionDetailViewModel | null = null;
  private currentView: vscode.WebviewView | null = null;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    this.render();
  }

  showSubmissionDetail(submission: SubmissionDetailViewModel): void {
    this.currentSubmission = submission;
    this.render();
  }

  private render(): void {
    if (!this.currentView) {
      return;
    }

    const submission = this.currentSubmission;
    this.currentView.webview.html = createDetailHtml({
      submissionId: submission?.submissionId ?? 'No submission selected',
      statusSummary: submission?.statusSummary ?? 'Select a submission from the Submissions list.',
      detail: submission?.detail ?? 'No submission details available yet.'
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createDetailHtml(input: SubmissionDetailViewModel): string {
  const submissionId = escapeHtml(input.submissionId);
  const statusSummary = escapeHtml(input.statusSummary);
  const detail = escapeHtml(input.detail);

  return `<!doctype html>
<html lang="en">
  <body>
    <h2>${submissionId}</h2>
    <p><strong>Status:</strong> ${statusSummary}</p>
    <hr />
    <pre style="white-space: pre-wrap;">${detail}</pre>
  </body>
</html>`;
}
