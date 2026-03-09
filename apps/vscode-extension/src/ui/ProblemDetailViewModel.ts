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

function renderInlineMarkdown(markdown: string): string {
  let rendered = escapeHtml(markdown);

  rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return rendered;
}

function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fencedCodeMatch = trimmed.match(/^```([A-Za-z0-9_-]+)?$/);
    if (fencedCodeMatch) {
      const language = fencedCodeMatch[1]?.trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const languageClass = language ? ` class="language-${escapeHtml(language)}"` : '';
      blocks.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    const listItemMatch = line.match(/^[-*+]\s+(.*)$/);
    if (listItemMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^[-*+]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(`<li>${renderInlineMarkdown(match[1].trim())}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index];
      const paragraphTrimmed = paragraphLine.trim();
      if (
        !paragraphTrimmed ||
        paragraphTrimmed.startsWith('```') ||
        /^#{1,6}\s+/.test(paragraphLine) ||
        /^[-*+]\s+/.test(paragraphLine)
      ) {
        break;
      }
      paragraphLines.push(paragraphTrimmed);
      index += 1;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(' '))}</p>`);
  }

  return blocks.join('\n');
}

export function createProblemDetailHtml(input: ProblemDetailViewModel): string {
  const title = escapeHtml(input.title);
  const problemId = escapeHtml(input.problemId);
  const statement = escapeHtml(input.statement);
  const starterFilePath = escapeHtml(input.starterFilePath ?? 'No problem selected yet.');
  const openStarterAttributes = input.isEmpty ? ' data-command="openStarter" disabled' : ' data-command="openStarter"';
  const runPublicTestsAttributes = input.isEmpty
    ? ' data-command="runPublicTests" disabled'
    : ' data-command="runPublicTests"';
  const submitAttributes = input.isEmpty
    ? ' data-command="submitCurrentFile" disabled'
    : ' data-command="submitCurrentFile"';
  const statementBody = input.isEmpty
    ? `<p role="status">${statement}</p>`
    : renderMarkdownToHtml(input.statement);
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 0 8px 16px;
      }

      a {
        color: var(--vscode-textLink-foreground);
      }

      code {
        font-family: var(--vscode-editor-font-family, monospace);
        background: var(--vscode-textCodeBlock-background);
        border-radius: 4px;
        padding: 0.1rem 0.3rem;
      }

      pre {
        background: var(--vscode-textCodeBlock-background);
        border-radius: 6px;
        overflow-x: auto;
        padding: 12px;
        white-space: pre-wrap;
      }

      pre code {
        background: transparent;
        padding: 0;
      }

      p, li {
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <h2>${title}</h2>
    <p><strong>Problem ID:</strong> <code>${problemId}</code></p>
    <p><strong>Starter File:</strong> <code>${starterFilePath}</code></p>
    <div>
      <vscode-button${openStarterAttributes}>Open Coding File</vscode-button>
      <vscode-button${runPublicTestsAttributes}>Run Public Tests</vscode-button>
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
