import path from 'node:path';
import { ProblemDetail, type PublicProblemTestCase } from '../api/PracticeApiClient';
import { resolveProblemStatementMarkdown } from './PracticeViewState';
import { createWebviewStyles, escapeHtml, formatCaseValue } from './WebviewTheme';

export type ProblemDetailViewModel = {
  title: string;
  problemId: string;
  statement: string;
  entryFunction: string;
  language: string | null;
  starterFilePath: string | null;
  examples: readonly PublicProblemTestCase[];
  publicTests: readonly PublicProblemTestCase[];
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
      examples: [],
      publicTests: [],
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
    examples: problem.examples ?? [],
    publicTests: problem.publicTests ?? [],
    isEmpty: false
  };
}

type StatementSections = {
  description: string;
  input: string;
  output: string;
  examples: string;
};

function normalizeHeadingLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function splitStatementSections(markdown: string): StatementSections {
  const sections: StatementSections = {
    description: '',
    input: '',
    output: '',
    examples: ''
  };
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let currentSection: keyof StatementSections = 'description';

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const headingLabel = normalizeHeadingLabel(headingMatch[2]);

      if (
        headingLabel === 'description' ||
        headingLabel === 'input' ||
        headingLabel === 'output' ||
        headingLabel === 'example' ||
        headingLabel === 'examples'
      ) {
        currentSection =
          headingLabel === 'example' || headingLabel === 'examples' ? 'examples' : headingLabel;
        continue;
      }
    }

    sections[currentSection] += `${line}\n`;
  }

  return {
    description: sections.description.trim(),
    input: sections.input.trim(),
    output: sections.output.trim(),
    examples: sections.examples.trim()
  };
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

function renderSectionContent(markdown: string, emptyMessage: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="markdown-content">${renderMarkdownToHtml(trimmed)}</div>`;
}

function renderExamples(
  examples: readonly PublicProblemTestCase[],
  examplesMarkdown: string,
  isEmpty: boolean
): string {
  if (isEmpty) {
    return '<p class="muted">Examples will appear after you select a problem.</p>';
  }

  if (examples.length > 0) {
    return `
      <div class="case-grid">
        ${examples
          .map(
            (example, index) => `
              <article class="case-card">
                <p class="field-label">Example ${index + 1}</p>
                <div class="case-stack">
                  <div>
                    <p class="field-label">Input</p>
                    <pre class="case-value">${escapeHtml(formatCaseValue(example.input))}</pre>
                  </div>
                  <div>
                    <p class="field-label">Output</p>
                    <pre class="case-value">${escapeHtml(formatCaseValue(example.output))}</pre>
                  </div>
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    `;
  }

  return renderSectionContent(examplesMarkdown, 'No examples provided yet.');
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
  const statementSections = splitStatementSections(input.statement);
  const statementBody = input.isEmpty
    ? `<p role="status" class="muted">${statement}</p>`
    : renderSectionContent(statementSections.description || input.statement, 'No description available yet.');
  const inputSection = renderSectionContent(
    statementSections.input,
    'No input format is documented yet.'
  );
  const outputSection = renderSectionContent(
    statementSections.output,
    'No output format is documented yet.'
  );
  const examplesSection = renderExamples(
    input.examples.length > 0 ? input.examples : input.publicTests,
    statementSections.examples,
    input.isEmpty
  );
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles()}
    </style>
  </head>
  <body>
    <main class="webview-shell section-stack">
      <section class="hero-card">
        <p class="eyebrow">Problem Detail</p>
        <h2>${title}</h2>
        <p class="hero-copy">Open the starter file, run public tests locally, and submit from one focused view.</p>
        <div class="inline-meta">
          <p><strong>Problem ID:</strong> <code>${problemId}</code></p>
          <p><strong>Starter File:</strong> <code>${starterFilePath}</code></p>
        </div>
        <div class="action-row">
          <vscode-button${openStarterAttributes}>Open Coding File</vscode-button>
          <vscode-button${runPublicTestsAttributes}>Run Public Tests</vscode-button>
          <vscode-button appearance="primary"${submitAttributes}>Submit</vscode-button>
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Description</p>
          <h3>What the problem is asking</h3>
        </div>
        ${statementBody}
      </section>

      <div class="field-grid">
        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Input</p>
            <h3>Expected input format</h3>
          </div>
          ${inputSection}
        </section>

        <section class="section-card">
          <div class="section-header">
            <p class="section-kicker">Output</p>
            <h3>Expected output format</h3>
          </div>
          ${outputSection}
        </section>
      </div>

      <section class="section-card">
        <div class="section-header">
          <p class="section-kicker">Examples</p>
          <h3>Student-visible examples</h3>
        </div>
        ${examplesSection}
      </section>
    </main>
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
