import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPracticeStateStore, MementoLike } from '../runtime/LocalPracticeStateStore';

class FakeMemento implements MementoLike {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

test('local practice state store persists selected problem and per-problem metadata', async () => {
  const memento = new FakeMemento();
  const store = new LocalPracticeStateStore(memento);

  await store.setSelectedProblemId('problem-1');
  await store.recordLastOpenedFile('problem-1', '/tmp/.oj/problems/problem-1.py');
  await store.recordLastSubmission('problem-1', 'submission-1');

  const reloaded = new LocalPracticeStateStore(memento);
  assert.equal(reloaded.getSelectedProblemId(), 'problem-1');
  assert.deepEqual(reloaded.getProblemState('problem-1'), {
    lastOpenedFilePath: '/tmp/.oj/problems/problem-1.py',
    lastSubmissionId: 'submission-1'
  });
});

test('local practice state store clears deleted-file path without removing last submission', async () => {
  const memento = new FakeMemento();
  const store = new LocalPracticeStateStore(memento);

  await store.recordLastOpenedFile('problem-1', '/tmp/.oj/problems/problem-1.py');
  await store.recordLastSubmission('problem-1', 'submission-1');
  await store.clearLastOpenedFile('problem-1');

  assert.deepEqual(store.getProblemState('problem-1'), {
    lastOpenedFilePath: undefined,
    lastSubmissionId: 'submission-1'
  });
});

test('local practice state store keeps problem state isolated by problem id', async () => {
  const store = new LocalPracticeStateStore(new FakeMemento());

  await store.recordLastOpenedFile('problem-1', '/tmp/p1.py');
  await store.recordLastSubmission('problem-2', 'submission-2');

  assert.deepEqual(store.getProblemState('problem-1'), {
    lastOpenedFilePath: '/tmp/p1.py'
  });
  assert.deepEqual(store.getProblemState('problem-2'), {
    lastSubmissionId: 'submission-2'
  });
});
