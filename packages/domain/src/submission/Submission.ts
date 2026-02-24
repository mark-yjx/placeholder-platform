import { SubmissionStatus } from './SubmissionStatus';

export class Submission {
  private constructor(
    public readonly id: string,
    public readonly status: SubmissionStatus
  ) {
    if (id.trim().length === 0) {
      throw new Error('Submission id is required');
    }
  }

  static createQueued(id: string): Submission {
    return new Submission(id, SubmissionStatus.QUEUED);
  }

  startRunning(): Submission {
    if (this.status !== SubmissionStatus.QUEUED) {
      throw new Error(`Invalid transition: ${this.status} -> ${SubmissionStatus.RUNNING}`);
    }
    return new Submission(this.id, SubmissionStatus.RUNNING);
  }

  finish(): Submission {
    if (this.status !== SubmissionStatus.RUNNING) {
      throw new Error(`Invalid transition: ${this.status} -> ${SubmissionStatus.FINISHED}`);
    }
    return new Submission(this.id, SubmissionStatus.FINISHED);
  }

  fail(): Submission {
    if (this.status !== SubmissionStatus.RUNNING) {
      throw new Error(`Invalid transition: ${this.status} -> ${SubmissionStatus.FAILED}`);
    }
    return new Submission(this.id, SubmissionStatus.FAILED);
  }
}
