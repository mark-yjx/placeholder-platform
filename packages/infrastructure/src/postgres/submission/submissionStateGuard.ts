import { SubmissionStatus } from '@packages/domain/src/submission';

export function assertSubmissionStartsQueued(status: SubmissionStatus): void {
  if (status !== SubmissionStatus.QUEUED) {
    throw new Error('New submissions must start in queued status');
  }
}

export function assertValidSubmissionTransition(
  currentStatus: SubmissionStatus,
  nextStatus: SubmissionStatus
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (currentStatus === SubmissionStatus.QUEUED && nextStatus === SubmissionStatus.RUNNING) {
    return;
  }

  if (
    currentStatus === SubmissionStatus.RUNNING &&
    (nextStatus === SubmissionStatus.FINISHED || nextStatus === SubmissionStatus.FAILED)
  ) {
    return;
  }

  throw new Error(`Invalid transition: ${currentStatus} -> ${nextStatus}`);
}
