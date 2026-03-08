import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProblemDetailHtml,
  createProblemDetailViewModel
} from '../ui/ProblemDetailViewModel';

test('fetched problem detail renders expected fields', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel({
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits',
      statementMarkdown: '# Collapse Identical Digits\n\nCollapse duplicate digits.',
      entryFunction: 'collapse',
      starterCode: 'def collapse(number):\n    raise NotImplementedError\n'
    }, '.oj/problems/collapse.py')
  );

  assert.match(html, /<h2>Collapse Identical Digits<\/h2>/);
  assert.match(html, /Problem ID:<\/strong> <code>collapse<\/code>/);
  assert.match(html, /Entry Function:<\/strong> <code>collapse<\/code>/);
  assert.match(html, /# Collapse Identical Digits/);
  assert.match(html, /Collapse duplicate digits\./);
  assert.match(html, /Problem File:<\/strong> <code>\.oj\/problems\/collapse\.py<\/code>/);
  assert.match(html, />Open</);
  assert.match(html, />Submit</);
  assert.match(html, />Refresh</);
});

test('empty state shows friendly placeholder instead of blank panel', () => {
  const html = createProblemDetailHtml(createProblemDetailViewModel(null, null));

  assert.match(html, /<h2>Problem Detail<\/h2>/);
  assert.match(html, /Fetch problems, then select one from the Problems list to view details here\./);
  assert.match(html, /Selecting a problem will load its title, statement, entry function, and actions here\./);
  assert.match(html, /<strong>Problem ID:<\/strong> <code>No problem selected yet\.<\/code>/);
  assert.match(html, /No problem selected yet\./);
  assert.match(html, /<button data-command="openStarter" disabled>Open<\/button>/);
  assert.match(html, /<button data-command="submitCurrentFile" disabled>Submit<\/button>/);
});

test('problem detail falls back safely when optional fields are missing', () => {
  const html = createProblemDetailHtml(
    createProblemDetailViewModel({
      problemId: 'legacy-problem',
      versionId: 'legacy-problem-v1',
      title: undefined as unknown as string,
      statementMarkdown: undefined as unknown as string,
      entryFunction: undefined as unknown as string,
      starterCode: 'print(42)\n'
    }, '.oj/problems/legacy-problem.py')
  );

  assert.match(html, /<h2>Untitled problem<\/h2>/);
  assert.match(html, /Entry Function:<\/strong> <code>Not available<\/code>/);
  assert.match(html, /Problem File:<\/strong> <code>\.oj\/problems\/legacy-problem\.py<\/code>/);
  assert.match(html, /<pre style="white-space: pre-wrap;"><\/pre>/);
});
