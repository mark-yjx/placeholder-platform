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
  assert.doesNotMatch(html, /Entry Function:/);
  assert.doesNotMatch(html, /Language:/);
  assert.match(html, /<h1>Collapse Identical Digits<\/h1>/);
  assert.match(html, /<p>Collapse duplicate digits\.<\/p>/);
  assert.match(html, /<ul><li>Keep the sign<\/li><li>Keep the order<\/li><\/ul>/);
  assert.match(html, /Use <code>collapse\(number\)<\/code>\./);
  assert.doesNotMatch(html, /<pre style="white-space: pre-wrap;">/);
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
