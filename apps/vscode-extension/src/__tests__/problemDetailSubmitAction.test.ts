import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProblemDetailMessage } from '../ui/ProblemDetailActions';

test('open button dispatches starter file flow for selected problem', async () => {
  const calls: string[] = [];

  await handleProblemDetailMessage(
    { command: 'openStarter' },
    {
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits'
    },
    {
      openStarterFile: async () => {
        calls.push('openStarter');
      },
      submitCurrentFile: async () => {
        calls.push('submitCurrentFile');
      },
      refreshProblem: async () => {
        calls.push('refreshProblem');
      }
    }
  );

  assert.deepEqual(calls, ['openStarter']);
});

test('submit button dispatches submitCurrentFile flow for selected problem', async () => {
  const calls: string[] = [];

  await handleProblemDetailMessage(
    { command: 'submitCurrentFile' },
    {
      problemId: 'collapse',
      versionId: 'collapse-v1',
      title: 'Collapse Identical Digits'
    },
    {
      openStarterFile: async () => {
        calls.push('openStarter');
      },
      submitCurrentFile: async () => {
        calls.push('submitCurrentFile');
      },
      refreshProblem: async () => {
        calls.push('refreshProblem');
      }
    }
  );

  assert.deepEqual(calls, ['submitCurrentFile']);
});
