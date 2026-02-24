import test from 'node:test';
import assert from 'node:assert/strict';

import { Role } from '../../identity';
import { Verdict } from '../../judge';
import { PublicationState } from '../../problem';
import { Submission } from '../../submission';
import {
  AuthorizationPolicyService,
  JudgePolicyService,
  RankingPolicyService,
  SubmissionPolicyService
} from '../index';

test('AuthorizationPolicyService enforces admin and submission permissions', () => {
  const service = new AuthorizationPolicyService();
  assert.equal(service.canAccessAdmin([Role.ADMIN]), true);
  assert.equal(service.canAccessAdmin([Role.STUDENT]), false);
  assert.equal(service.canSubmit([Role.STUDENT]), true);
  assert.equal(service.canSubmit([Role.ADMIN]), false);
});

test('SubmissionPolicyService enforces role, publication and language checks', () => {
  const service = new SubmissionPolicyService();
  assert.deepEqual(
    service.evaluate({ actorRoles: [Role.STUDENT], isProblemPublished: true, language: 'python' }),
    { allowed: true }
  );
  assert.deepEqual(
    service.evaluate({ actorRoles: [Role.ADMIN], isProblemPublished: true, language: 'python' }),
    { allowed: false, reason: 'Only students may submit solutions' }
  );
  assert.deepEqual(
    service.evaluate({ actorRoles: [Role.STUDENT], isProblemPublished: false, language: 'python' }),
    { allowed: false, reason: 'Problem must be published' }
  );
  assert.deepEqual(
    service.evaluate({ actorRoles: [Role.STUDENT], isProblemPublished: true, language: 'javascript' }),
    { allowed: false, reason: 'Unsupported language' }
  );
  assert.equal(service.isPublishedState(PublicationState.PUBLISHED), true);
});

test('JudgePolicyService allows only queued start and running finalize', () => {
  const service = new JudgePolicyService();
  const queued = Submission.createQueued('submission-1');
  const running = queued.startRunning();

  assert.equal(service.canStart(queued), true);
  assert.equal(service.canStart(running), false);
  assert.equal(service.canFinalize(queued), false);
  assert.equal(service.canFinalize(running), true);
});

test('RankingPolicyService ranks by composite score using best submissions only', () => {
  const service = new RankingPolicyService();
  const ranked = service.rank([
    {
      submissionId: 's-1',
      userId: 'u1',
      problemId: 'p1',
      verdict: Verdict.WA,
      timeMs: 20,
      createdAtEpochMs: 1
    },
    {
      submissionId: 's-2',
      userId: 'u1',
      problemId: 'p1',
      verdict: Verdict.AC,
      timeMs: 200,
      createdAtEpochMs: 2
    },
    {
      submissionId: 's-3',
      userId: 'u1',
      problemId: 'p2',
      verdict: Verdict.AC,
      timeMs: 320,
      createdAtEpochMs: 3
    },
    {
      submissionId: 's-4',
      userId: 'u2',
      problemId: 'p1',
      verdict: Verdict.AC,
      timeMs: 100,
      createdAtEpochMs: 1
    },
    {
      submissionId: 's-5',
      userId: 'u2',
      problemId: 'p2',
      verdict: Verdict.AC,
      timeMs: 150,
      createdAtEpochMs: 2
    },
    {
      submissionId: 's-6',
      userId: 'u3',
      problemId: 'p1',
      verdict: Verdict.AC,
      timeMs: 90,
      createdAtEpochMs: 1
    }
  ]);

  assert.deepEqual(ranked.map((entry) => entry.userId), ['u2', 'u1', 'u3']);
  assert.equal(ranked[0]?.bestSubmissionCount, 2);
  assert.equal(ranked[1]?.bestSubmissionCount, 2);
});

test('RankingPolicyService uses tie-break policy for equal composite scores', () => {
  const service = new RankingPolicyService();
  const ranked = service.rank([
    {
      submissionId: 's-a',
      userId: 'uA',
      problemId: 'p1',
      verdict: Verdict.AC,
      timeMs: 100,
      createdAtEpochMs: 1
    },
    {
      submissionId: 's-b',
      userId: 'uB',
      problemId: 'p1',
      verdict: Verdict.AC,
      timeMs: 100,
      createdAtEpochMs: 1
    }
  ]);

  assert.deepEqual(ranked.map((entry) => entry.userId), ['uA', 'uB']);
});
