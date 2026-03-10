import path from 'node:path';
import { ProblemDetail, type PublicProblemTestCase } from '../api/PracticeApiClient';
import { resolveProblemStatementMarkdown } from './PracticeViewState';
import { createWebviewStyles, escapeHtml, formatCaseValue } from './WebviewTheme';

export type ProblemDetailViewModel = {
  title: string;
  summary: string;
  emptyStateMessage: string;
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
      title: 'Choose a problem',
      summary: 'Pick a problem from the list to read the prompt, inspect examples, and start solving.',
      emptyStateMessage: 'Select a problem from the Problems list to view details.',
      problemId: '',
      statement: '',
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
  const summary = extractProblemSummary(statement, title);

  return {
    title,
    summary,
    emptyStateMessage: '',
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

function stripMarkdownForSummary(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProblemSummary(statement: string, title: string): string {
  const paragraphs = statement
    .split(/\n\s*\n/)
    .map((paragraph) => stripMarkdownForSummary(paragraph))
    .filter((paragraph) => paragraph.length > 0);

  const normalizedTitle = title.trim().toLowerCase();
  const summary =
    paragraphs.find((paragraph) => paragraph.trim().toLowerCase() !== normalizedTitle) ??
    paragraphs[0];

  return summary || 'Read the prompt, inspect the examples, and solve the problem in your workspace.';
}

type StatementSections = {
  description: string;
  input: string;
  output: string;
  examples: string;
};

const STATEMENT_SECTION_ALIASES: Record<keyof StatementSections, readonly string[]> = {
  description: ['description'],
  input: ['input', 'input format'],
  output: ['output', 'output format'],
  examples: ['example', 'examples']
};

function normalizeHeadingLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolveStatementSection(headingLabel: string): keyof StatementSections | null {
  for (const [section, aliases] of Object.entries(STATEMENT_SECTION_ALIASES) as [
    keyof StatementSections,
    readonly string[]
  ][]) {
    if (aliases.includes(headingLabel)) {
      return section;
    }
  }

  return null;
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
      const section = resolveStatementSection(headingLabel);
      if (section) {
        currentSection = section;
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

function stripLeadingPresentationHeadings(markdown: string, labels: readonly string[]): string {
  const normalizedLabels = new Set(
    labels
      .map((label) => normalizeHeadingLabel(label))
      .filter((label) => label.length > 0)
  );
  if (normalizedLabels.size === 0) {
    return markdown.trim();
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let startIndex = 0;

  while (startIndex < lines.length) {
    while (startIndex < lines.length && lines[startIndex].trim().length === 0) {
      startIndex += 1;
    }

    const line = lines[startIndex];
    const headingMatch = line?.match(/^(#{1,6})\s+(.*)$/);
    if (!headingMatch) {
      break;
    }

    const headingLabel = normalizeHeadingLabel(headingMatch[2]);
    if (!normalizedLabels.has(headingLabel)) {
      break;
    }

    startIndex += 1;
  }

  return lines.slice(startIndex).join('\n').trim();
}

function renderExamples(
  examples: readonly PublicProblemTestCase[],
  examplesMarkdown: string,
  isEmpty: boolean
): string {
  if (isEmpty) {
    return '<p class="muted">Examples will appear after you select a problem.</p>';
  }

  const renderedExamplesMarkdown = examplesMarkdown.trim()
    ? `<div class="examples-copy">${renderSectionContent(examplesMarkdown, 'No examples provided yet.')}</div>`
    : '';

  if (examples.length > 0) {
    return `
      ${renderedExamplesMarkdown}
      <div class="examples-panel">
        ${examples
          .map(
            (example, index) => `
              <article class="example-card">
                <h4 class="example-title">Example ${index + 1}</h4>
                <div class="example-grid">
                  <section class="example-field">
                    <p class="example-field-label">Input</p>
                    <pre class="example-surface">${escapeHtml(formatCaseValue(example.input))}</pre>
                  </section>
                  <section class="example-field">
                    <p class="example-field-label">Output</p>
                    <pre class="example-surface">${escapeHtml(formatCaseValue(example.output))}</pre>
                  </section>
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
  const summary = escapeHtml(input.summary);
  const emptyStateMessage = escapeHtml(input.emptyStateMessage);
  const problemId = escapeHtml(input.problemId);
  const starterFilePath = escapeHtml(input.starterFilePath ?? 'No problem selected yet.');
  const openStarterAttributes = input.isEmpty ? ' data-command="openStarter" disabled' : ' data-command="openStarter"';
  const runPublicTestsAttributes = input.isEmpty
    ? ' data-command="runPublicTests" disabled'
    : ' data-command="runPublicTests"';
  const submitAttributes = input.isEmpty
    ? ' data-command="submitCurrentFile" disabled'
    : ' data-command="submitCurrentFile"';
  const statementSections = splitStatementSections(input.statement);
  const statementBody = renderSectionContent(
    stripLeadingPresentationHeadings(statementSections.description || input.statement, [
      input.title,
      'description'
    ]),
    'No description available yet.'
  );
  const inputSection = renderSectionContent(
    stripLeadingPresentationHeadings(statementSections.input, ['input', 'input format']),
    'No input format is documented yet.'
  );
  const outputSection = renderSectionContent(
    stripLeadingPresentationHeadings(statementSections.output, ['output', 'output format']),
    'No output format is documented yet.'
  );
  const examplesSection = renderExamples(
    input.examples.length > 0 ? input.examples : input.publicTests,
    stripLeadingPresentationHeadings(statementSections.examples, ['example', 'examples']),
    input.isEmpty
  );
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';
  const practiceReadingStyles = `
    body {
      padding: 16px;
    }

    .problem-detail-shell {
      max-width: 760px;
      gap: 16px;
      font-size: 0.92rem;
    }

    .problem-detail-shell .hero-card h2 {
      font-size: 1.55rem;
    }

    .problem-detail-shell .hero-copy,
    .problem-detail-shell .markdown-content,
    .problem-detail-shell pre {
      font-size: 0.9rem;
    }

    .problem-detail-shell .problem-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .problem-detail-shell .problem-meta p {
      color: var(--text-secondary);
    }

    .problem-detail-shell .problem-actions {
      display: grid;
      gap: 10px;
      margin-top: 6px;
    }

    .problem-detail-shell .primary-action vscode-button,
    .problem-detail-shell .secondary-actions vscode-button {
      width: 100%;
    }

    .problem-detail-shell .secondary-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
    }

    .problem-detail-shell .problem-sections,
    .problem-detail-shell .example-grid,
    .problem-detail-shell .io-grid {
      display: grid;
      gap: 12px;
    }

    .problem-detail-shell .io-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .problem-detail-shell .primary-action vscode-button::part(control) {
      justify-content: center;
      min-height: 40px;
      font-size: 0.86rem;
      font-weight: 600;
    }

    .problem-detail-shell .secondary-actions vscode-button::part(control) {
      justify-content: center;
      min-height: 38px;
      font-size: 0.84rem;
    }

    .problem-detail-shell .io-card .markdown-content,
    .problem-detail-shell .io-card .muted {
      margin-top: 2px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--surface-muted) 76%, transparent), transparent 140%),
        color-mix(in srgb, var(--surface-muted) 44%, var(--surface));
    }

    .problem-detail-shell .examples-panel {
      display: grid;
      gap: 12px;
      margin-top: 2px;
    }

    .problem-detail-shell .examples-copy {
      margin-bottom: 12px;
    }

    .problem-detail-shell .example-card {
      display: grid;
      gap: 10px;
      padding: 14px 16px 16px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--surface-muted) 70%, transparent), transparent 150%),
        color-mix(in srgb, var(--surface-muted) 26%, var(--surface));
    }

    .problem-detail-shell .example-title {
      font-size: 0.98rem;
      line-height: 1.25;
      letter-spacing: -0.01em;
      font-weight: 600;
    }

    .problem-detail-shell .example-grid {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    }

    .problem-detail-shell .example-field {
      display: grid;
      min-width: 0;
      gap: 6px;
    }

    .problem-detail-shell .example-field-label {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }

    .problem-detail-shell .example-surface {
      margin: 0;
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
      border-radius: 12px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--vscode-textCodeBlock-background) 88%, transparent), transparent 160%),
        color-mix(in srgb, var(--vscode-textCodeBlock-background) 72%, var(--surface));
      font-size: 0.84rem;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    @media (max-width: 640px) {
      .problem-detail-shell .secondary-actions {
        grid-template-columns: minmax(0, 1fr);
      }

      .problem-detail-shell .io-grid,
      .problem-detail-shell .example-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles()}
      ${practiceReadingStyles}
    </style>
  </head>
  <body>
    <main class="webview-shell section-stack problem-detail-shell">
      <section class="hero-card">
        <p class="eyebrow">Placeholder Practice</p>
        <h2>${title}</h2>
        <p class="hero-copy">${summary}</p>
        ${
          input.isEmpty
            ? `<div class="alert-card"><p role="status">${emptyStateMessage}</p></div>`
            : `
              <div class="problem-meta">
                <p><strong>Problem ID:</strong> <code>${problemId}</code></p>
                <p><strong>Starter File:</strong> <code>${starterFilePath}</code></p>
              </div>
            `
        }
        ${
          input.isEmpty
            ? ''
            : `
              <div class="problem-actions">
                <div class="primary-action">
                  <vscode-button appearance="primary"${openStarterAttributes}>Open Coding File</vscode-button>
                </div>
                <div class="secondary-actions">
                  <vscode-button${runPublicTestsAttributes}>Run Public Tests</vscode-button>
                  <vscode-button${submitAttributes}>Submit</vscode-button>
                </div>
              </div>
            `
        }
      </section>

      ${
        input.isEmpty
          ? ''
          : `
            <section class="section-card">
              <div class="section-header">
                <p class="section-kicker">Description</p>
                <h3>Description</h3>
              </div>
              ${statementBody}
            </section>

            <div class="io-grid">
              <section class="section-card io-card">
                <div class="section-header">
                  <p class="section-kicker">Input</p>
                  <h3>Input</h3>
                </div>
                  ${inputSection}
              </section>
              <section class="section-card io-card">
                <div class="section-header">
                  <p class="section-kicker">Output</p>
                  <h3>Output</h3>
                </div>
                  ${outputSection}
              </section>
            </div>

            <section class="section-card">
              <div class="section-header">
                <p class="section-kicker">Examples</p>
                <h3>Examples</h3>
              </div>
              ${examplesSection}
            </section>
          `
      }
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
