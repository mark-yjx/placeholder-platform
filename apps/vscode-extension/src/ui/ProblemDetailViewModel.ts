import path from 'node:path';
import { ProblemDetail } from '../api/PracticeApiClient';
import { resolveProblemStatementMarkdown } from './PracticeViewState';

export type ProblemDetailViewModel = {
  title: string;
  problemId: string;
  statement: string;
  entryFunction: string;
  language: string | null;
  starterFilePath: string | null;
  isEmpty: boolean;
};

export function createProblemDetailViewModel(
  problem: ProblemDetail | null,
  starterFilePath: string | null
): ProblemDetailViewModel {
  if (!problem) {
    return {
      title: 'Problem Detail',
      problemId: 'No problem selected yet.',
      statement: 'Select a problem from the Problems list to view details.',
      entryFunction: 'No problem selected yet.',
      language: null,
      starterFilePath: null,
      isEmpty: true
    };
  }

  const title = problem.title?.trim() || 'Untitled problem';
  const statement = resolveProblemStatementMarkdown(problem) ?? 'No statement available.';
  const entryFunction = problem.entryFunction?.trim() || 'Unknown';
  const language = problem.language?.trim() ?? null;
  const starterFileLabel = starterFilePath?.trim()
    ? path.basename(starterFilePath)
    : `${problem.problemId}.py`;

  return {
    title,
    problemId: problem.problemId,
    statement,
    entryFunction,
    language,
    starterFilePath: starterFileLabel,
    isEmpty: false
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createProblemDetailHtml(input: ProblemDetailViewModel): string {
  const title = escapeHtml(input.title);
  const problemId = escapeHtml(input.problemId);
  const statement = escapeHtml(input.statement);
  const starterFilePath = escapeHtml(input.starterFilePath ?? 'No problem selected yet.');
  const openStarterAttributes = input.isEmpty ? ' data-command="openStarter" disabled' : ' data-command="openStarter"';
  const submitAttributes = input.isEmpty
    ? ' data-command="submitCurrentFile" disabled'
    : ' data-command="submitCurrentFile"';
  const statementBody = input.isEmpty
    ? `<p role="status">${statement}</p>`
    : `<pre style="white-space: pre-wrap;">${statement}</pre>`;
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
  </head>
  <body>
    <h2>${title}</h2>
    <p><strong>Problem ID:</strong> <code>${problemId}</code></p>
    <p><strong>Starter File:</strong> <code>${starterFilePath}</code></p>
    <div>
      <vscode-button${openStarterAttributes}>Open Coding File</vscode-button>
      <vscode-button appearance="primary"${submitAttributes}>Submit</vscode-button>
    </div>
    <hr />
    <h3>Statement</h3>
    ${statementBody}
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('vscode-button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}
