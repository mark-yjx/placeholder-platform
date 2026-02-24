import test from 'node:test';
import assert from 'node:assert/strict';

import { Problem, ProblemVersion, PublicationState } from '../index';

test('published versions are immutable', () => {
  const problem = new Problem('problem-1', [
    ProblemVersion.createDraft({
      id: 'version-1',
      versionNumber: 1,
      title: 'Two Sum',
      statement: 'Find two numbers with target sum.'
    })
  ]);

  const published = problem.publishLatestVersion();

  assert.equal(published.publicationState, PublicationState.PUBLISHED);
  assert.throws(() => {
    (published as unknown as { title: string }).title = 'Mutated';
  }, /Cannot assign to read only property/);
});

test('editing a problem creates a new version', () => {
  const problem = new Problem('problem-1', [
    ProblemVersion.createDraft({
      id: 'version-1',
      versionNumber: 1,
      title: 'Two Sum',
      statement: 'Find two numbers with target sum.'
    })
  ]);

  const version1 = problem.publishLatestVersion();
  const version2 = problem.createEditedVersion('version-2', {
    title: 'Two Sum (revised)'
  });

  assert.equal(version1.versionNumber, 1);
  assert.equal(version1.publicationState, PublicationState.PUBLISHED);
  assert.equal(version1.title, 'Two Sum');

  assert.equal(version2.versionNumber, 2);
  assert.equal(version2.publicationState, PublicationState.DRAFT);
  assert.equal(version2.title, 'Two Sum (revised)');
  assert.equal(problem.versions.length, 2);
});
