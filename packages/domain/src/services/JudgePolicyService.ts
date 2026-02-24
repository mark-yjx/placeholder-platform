import { Submission, SubmissionStatus } from '../submission';

export class JudgePolicyService {
  canStart(submission: Submission): boolean {
    return submission.status === SubmissionStatus.QUEUED;
  }

  canFinalize(submission: Submission): boolean {
    return submission.status === SubmissionStatus.RUNNING;
  }
}
