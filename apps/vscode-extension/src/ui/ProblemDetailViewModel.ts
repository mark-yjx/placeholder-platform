import { ProblemDetail } from '../api/PracticeApiClient';
import { resolveProblemStatementMarkdown } from './PracticeViewState';

export type ProblemDetailViewModel = {
  title: string;
  problemId: string;
  statement: string;
  entryFunction: string;
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
      statement: 'Fetch problems, then select one from the Problems list to view details here.',
      entryFunction: 'No problem selected yet.',
      starterFilePath: null,
      isEmpty: true
    };
  }

  return {
    title: problem.title,
    problemId: problem.problemId,
    statement:
      resolveProblemStatementMarkdown(problem) ??
      'No statementMarkdown content is available for this problem yet.',
    entryFunction: problem.entryFunction.trim() || 'Problem manifest entryFunction is missing.',
    starterFilePath,
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
  const entryFunction = escapeHtml(input.entryFunction);
  const starterFilePath = escapeHtml(input.starterFilePath ?? 'No file path available yet.');
  const openStarterAttributes = input.isEmpty ? ' data-command="openStarter" disabled' : ' data-command="openStarter"';
  const submitAttributes = input.isEmpty
    ? ' data-command="submitCurrentFile" disabled'
    : ' data-command="submitCurrentFile"';
  const refreshAttributes = input.isEmpty ? ' data-command="refreshProblem" disabled' : ' data-command="refreshProblem"';
  const emptyState = input.isEmpty
    ? '<p>Selecting a problem will load its title, statement, entry function, and actions here.</p>'
    : '';

  return `<!doctype html>
<html lang="en">
  <body>
    <h2>${title}</h2>
    ${emptyState}
    <p><strong>Problem ID:</strong> <code>${problemId}</code></p>
    <p><strong>Entry Function:</strong> <code>${entryFunction}</code></p>
    <p><strong>Problem File:</strong> <code>${starterFilePath}</code></p>
    <div>
      <button${openStarterAttributes}>Open</button>
      <button${submitAttributes}>Submit</button>
      <button${refreshAttributes}>Refresh</button>
    </div>
    <hr />
    <h3>Statement</h3>
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
