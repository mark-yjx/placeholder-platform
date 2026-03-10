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
  assert.match(html, /<h2>Collapse Identical Digits<\/h2>/);
  assert.match(html, /Problem ID:<\/strong> <code>collapse<\/code>/);
  assert.match(html, /What the problem is asking/);
  assert.match(html, /Expected input format/);
  assert.match(html, /Expected output format/);
  assert.match(html, /Input and output contract/);
  assert.match(html, /class="format-panel"/);
  assert.match(html, /Student-visible examples/);
  assert.match(html, /class="action-cluster"/);
  assert.match(html, /class="secondary-actions"/);
  assert.match(html, /class="primary-action"/);
  assert.doesNotMatch(html, /Entry Function:/);
  assert.doesNotMatch(html, /Language:/);
  assert.match(html, /<h1>Collapse Identical Digits<\/h1>/);
  assert.match(html, /<p>Collapse duplicate digits\.<\/p>/);
  assert.match(html, /<ul><li>Keep the sign<\/li><li>Keep the order<\/li><\/ul>/);
  assert.match(html, /Use <code>collapse\(number\)<\/code>\./);
  assert.doesNotMatch(html, /<pre style="white-space: pre-wrap;">/);
  assert.match(html, /max-width: 720px/);
  assert.match(html, /font-size: 0\.92rem/);
  assert.match(html, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(html, /font-size: 0\.86rem/);
  assert.match(html, /width: 100%/);
  assert.match(html, /Starter File:<\/strong> <code>collapse\.py<\/code>/);
  assert.doesNotMatch(html, /\/home\/mark\/src\/oj-vscode\/\.oj\/problems\/collapse\.py/);
  assert.match(html, /<vscode-button data-command="openStarter">Open Coding File<\/vscode-button>/);
  assert.match(html, /<vscode-button data-command="runPublicTests">Run Public Tests<\/vscode-button>/);
  assert.match(html, /<vscode-button appearance="primary" data-command="submitCurrentFile">Submit<\/vscode-button>/);
  assert.doesNotMatch(html, /Refresh/);
});

test('empty state shows friendly placeholder instead of blank panel', () => {
  const html = createProblemDetailHtml(createProblemDetailViewModel(null, null));

  assert.match(html, /<h2>Problem Detail<\/h2>/);
  assert.match(html, /Select a problem from the Problems list to view details\./);
  assert.match(html, /<strong>Problem ID:<\/strong> <code>No problem selected yet\.<\/code>/);
  assert.match(html, /No problem selected yet\./);
  assert.match(html, /<strong>Starter File:<\/strong> <code>No problem selected yet\.<\/code>/);
  assert.match(html, /Examples will appear after you select a problem\./);
  assert.match(html, /<vscode-button data-command="openStarter" disabled>Open Coding File<\/vscode-button>/);
  assert.match(html, /<vscode-button data-command="runPublicTests" disabled>Run Public Tests<\/vscode-button>/);
  assert.match(html, /<vscode-button appearance="primary" data-command="submitCurrentFile" disabled>Submit<\/vscode-button>/);
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

