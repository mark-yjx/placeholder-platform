import test from 'node:test';
import assert from 'node:assert/strict';
import { createProblemDetailHtml, createProblemDetailViewModel } from '../ui/ProblemDetailViewModel';

test('fetched problem detail renders expected fields', () => {
  const viewModel = createProblemDetailViewModel({
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits',
      statementMarkdown:
        '# Collapse Identical Digits\n\nCollapse duplicate digits.\n\n- Keep the sign\n- Keep the order\n\nUse `collapse(number)`.',
      entryFunction: 'collapse',
      language: 'python',
      starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
    }, '/home/mark/src/oj-vscode/.oj/problems/collapse.py');
  const html = createProblemDetailHtml(viewModel);

  assert.equal(viewModel.entryFunction, 'collapse');
  assert.equal(viewModel.summary, 'Collapse duplicate digits.');
  assert.match(html, /<h2>Collapse Identical Digits<\/h2>/);
  assert.match(html, /<p class="hero-copy">Collapse duplicate digits\.<\/p>/);
  assert.match(html, /Problem ID:<\/strong> <code>collapse<\/code>/);
  assert.match(html, /<h3>Description<\/h3>/);
  assert.match(html, /<h3>Input<\/h3>/);
  assert.match(html, /<h3>Output<\/h3>/);
  assert.match(html, /<h3>Examples<\/h3>/);
  assert.match(html, /class="io-grid"/);
  assert.match(html, /class="problem-actions"/);
  assert.match(html, /class="secondary-actions"/);
  assert.match(html, /class="primary-action"/);
  assert.doesNotMatch(html, /Entry Function:/);
  assert.doesNotMatch(html, /Language:/);
  assert.doesNotMatch(html, /<h1>Collapse Identical Digits<\/h1>/);
  assert.match(html, /<p>Collapse duplicate digits\.<\/p>/);
  assert.match(html, /<ul><li>Keep the sign<\/li><li>Keep the order<\/li><\/ul>/);
  assert.match(html, /Use <code>collapse\(number\)<\/code>\./);
  assert.doesNotMatch(html, /<pre style="white-space: pre-wrap;">/);
  assert.match(html, /max-width: 760px/);
  assert.match(html, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html, /Starter File:<\/strong> <code>collapse\.py<\/code>/);
  assert.doesNotMatch(html, /\/home\/mark\/src\/oj-vscode\/\.oj\/problems\/collapse\.py/);
  assert.match(html, /<vscode-button appearance="primary" data-command="openStarter">Open Coding File<\/vscode-button>/);
  assert.match(html, /<vscode-button data-command="runPublicTests">Run Public Tests<\/vscode-button>/);
  assert.match(html, /<vscode-button data-command="submitCurrentFile">Submit<\/vscode-button>/);
  assert.doesNotMatch(html, /Refresh/);
});

test('empty state shows friendly placeholder instead of blank panel', () => {
  const html = createProblemDetailHtml(createProblemDetailViewModel(null, null));

  assert.match(html, /<h2>Choose a problem<\/h2>/);
  assert.match(html, /Pick a problem from the list to read the prompt, inspect examples, and start solving\./);
  assert.match(html, /Select a problem from the Problems list to view details\./);
  assert.doesNotMatch(html, /Problem ID:/);
  assert.doesNotMatch(html, /Starter File:/);
  assert.doesNotMatch(html, /<h3>Description<\/h3>/);
  assert.doesNotMatch(html, /<h3>Input<\/h3>/);
  assert.doesNotMatch(html, /<h3>Output<\/h3>/);
  assert.doesNotMatch(html, /<h3>Examples<\/h3>/);
  assert.doesNotMatch(html, /Open Coding File/);
  assert.doesNotMatch(html, /Run Public Tests/);
  assert.doesNotMatch(html, />Submit</);
});

test('problem detail falls back safely when optional fields are missing', () => {
  const viewModel = createProblemDetailViewModel({
      problemId: 'legacy-problem',
      versionId: 'legacy-problem-v1',
      title: undefined as unknown as string,
      statementMarkdown: undefined as unknown as string,
      entryFunction: undefined as unknown as string,
      starterCode: 'print(42)\n'
    }, '/tmp/workspace/.oj/problems/legacy-problem.py');
  const html = createProblemDetailHtml(viewModel);

  assert.equal(viewModel.entryFunction, 'Unknown');
  assert.match(html, /<h2>Untitled problem<\/h2>/);
  assert.doesNotMatch(html, /Entry Function:/);
  assert.match(html, /<p class="hero-copy">No statement available\.<\/p>/);
  assert.match(html, /Starter File:<\/strong> <code>legacy-problem\.py<\/code>/);
  assert.doesNotMatch(html, /\/tmp\/workspace\/\.oj\/problems\/legacy-problem\.py/);
  assert.match(html, /No statement available\./);
});

test('problem detail renders fenced code blocks as HTML code blocks', () => {
  const viewModel = createProblemDetailViewModel({
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits',
      statementMarkdown: '```python\ndef collapse(number):\n    return number\n```',
      entryFunction: 'collapse',
      language: 'python',
      starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
    }, '/home/mark/src/oj-vscode/.oj/problems/collapse.py');
  const html = createProblemDetailHtml(viewModel);

  assert.match(html, /<pre><code class="language-python">def collapse\(number\):\n    return number<\/code><\/pre>/);
});

test('problem detail renders manifest examples as rows inside one shared panel', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel(
      {
        problemId: 'collapse',
        versionId: 'collapse-v1',
        title: 'Collapse Identical Digits',
        statementMarkdown: 'Collapse duplicate digits.',
        entryFunction: 'collapse',
        language: 'python',
        starterCode: 'def collapse(number):\n    raise NotImplementedError\n',
        examples: [{ input: 112233, output: 123 }]
      },
      '/home/mark/src/oj-vscode/.oj/problems/collapse.py'
    )
  );

  assert.match(html, /class="examples-panel"/);
  assert.match(html, /class="example-card"/);
  assert.match(html, /<h4 class="example-title">Example 1<\/h4>/);
  assert.match(html, /class="example-grid"/);
  assert.match(html, /<p class="example-field-label">Input<\/p>/);
  assert.match(html, /<p class="example-field-label">Output<\/p>/);
  assert.match(html, /class="example-surface">112233<\/pre>/);
  assert.match(html, /class="example-surface">123<\/pre>/);
  assert.match(html, /112233/);
  assert.match(html, /123/);
  assert.doesNotMatch(html, /class="example-row"/);
  assert.doesNotMatch(html, /class="example-label-rail"/);
  assert.doesNotMatch(html, /class="field-label">Input<\/p>/);
});

test('problem detail recognizes input format and output format headings', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel(
      {
        problemId: 'formatted-problem',
        versionId: 'formatted-problem-v1',
        title: 'Formatted Problem',
        statementMarkdown:
          '# Formatted Problem\n\nMain description.\n\n## Input Format\n\nOne integer per line.\n\n## Output Format\n\nReturn the collapsed value.\n\n## Notes\n\nKeep the sign.',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n'
      },
      '/home/mark/src/oj-vscode/.oj/problems/formatted-problem.py'
    )
  );

  assert.match(html, /<h3>Input<\/h3>/);
  assert.match(html, /<h3>Output<\/h3>/);
  assert.match(html, /One integer per line\./);
  assert.match(html, /Return the collapsed value\./);
  assert.match(html, /<h2>Notes<\/h2>/);
  assert.match(html, /Keep the sign\./);
  assert.doesNotMatch(html, /Input Format/);
  assert.doesNotMatch(html, /Output Format/);
});

test('problem detail preserves example markdown alongside structured examples', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel(
      {
        problemId: 'example-problem',
        versionId: 'example-problem-v1',
        title: 'Example Problem',
        statementMarkdown:
          '# Example Problem\n\nBase description.\n\n## Examples\n\nUse the examples below to verify edge cases.',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n',
        examples: [{ input: 111122223333, output: 123 }]
      },
      '/home/mark/src/oj-vscode/.oj/problems/example-problem.py'
    )
  );

  assert.match(html, /class="examples-copy"/);
  assert.match(html, /Use the examples below to verify edge cases\./);
  assert.match(html, /<h4 class="example-title">Example 1<\/h4>/);
  assert.match(html, /111122223333/);
  assert.match(html, /123/);
  assert.doesNotMatch(html, /<h2>Examples<\/h2>/);
  assert.doesNotMatch(html, /<h3>Examples<\/h3>.*<h3>Examples<\/h3>/s);
});

test('problem detail tolerates sparse example payloads without crashing', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel(
      {
        problemId: 'sparse-problem',
        versionId: 'sparse-problem-v1',
        title: 'Sparse Problem',
        statementMarkdown: 'Handle incomplete example payloads.',
        entryFunction: 'solve',
        starterCode: 'def solve():\n    return 42\n',
        examples: [
          {
            input: undefined as unknown as string,
            output: 42
          }
        ]
      },
      '/home/mark/src/oj-vscode/.oj/problems/sparse-problem.py'
    )
  );

  assert.match(html, /class="examples-panel"/);
  assert.match(html, /<p class="example-field-label">Input<\/p>/);
  assert.match(html, /<pre class="example-surface"><\/pre>/);
  assert.match(html, /<pre class="example-surface">42<\/pre>/);
});
