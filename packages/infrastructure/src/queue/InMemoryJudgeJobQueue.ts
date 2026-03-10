import { Judge } from '@placeholder/contracts/src';
import { JudgeJobQueue } from '@placeholder/application/src/submission/CreateSubmissionUseCase';

export class InMemoryJudgeJobQueue implements JudgeJobQueue {
  private readonly jobs: Judge.JudgeJob[] = [];

  async enqueue(job: Judge.JudgeJob): Promise<void> {
    this.jobs.push({ ...job });
  }

  listJobs(): readonly Judge.JudgeJob[] {
    return [...this.jobs];
  }
}
