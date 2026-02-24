import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProblemPayload } from '../index';

test('accepts valid MVP payload with python language', () => {
  const issues = validateProblemPayload({
    title: 'Two Sum',
    statement: 'Find two numbers.',
    metadata: { difficulty: 'easy', language: 'python' }
  });
  assert.deepEqual(issues, []);
});

test('rejects invalid payload with deterministic validation errors', () => {
  const issues = validateProblemPayload({
    title: '',
    statement: '',
    metadata: { difficulty: '', language: '' }
  });

  assert.deepEqual(issues, [
    { code: 'title_required', message: 'Title is required' },
    { code: 'statement_required', message: 'Statement is required' },
    { code: 'difficulty_required', message: 'Difficulty is required' },
    { code: 'language_required', message: 'Language is required' }
  ]);
});

test('rejects unsupported non-python language', () => {
  const issues = validateProblemPayload({
    title: 'A + B',
    statement: 'Output sum.',
    metadata: { difficulty: 'easy', language: 'java' }
  });

  assert.deepEqual(issues, [
    {
      code: 'language_unsupported',
      message: 'Only python language is supported for MVP'
    }
  ]);
});
