import test from 'node:test';
import assert from 'node:assert/strict';

import { Role } from '../../identity';
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

test('RankingPolicyService sorts by score then solved count then user id', () => {
  const service = new RankingPolicyService();
  const ranked = service.rank([
    { userId: 'u3', score: 100, solvedCount: 2 },
    { userId: 'u1', score: 200, solvedCount: 1 },
    { userId: 'u2', score: 100, solvedCount: 3 }
  ]);

  assert.deepEqual(ranked.map((entry) => entry.userId), ['u1', 'u2', 'u3']);
});
