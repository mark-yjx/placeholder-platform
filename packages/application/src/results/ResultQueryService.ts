import { SubmissionStatus } from '@packages/domain/src/submission';
import { PersistedJudgeResult } from './JudgeCallbackIngestionService';

export type SubmissionResultView = {
  submissionId: string;
  ownerUserId: string;
  status: SubmissionStatus;
  verdict?: string;
  timeMs?: number;
  memoryKb?: number;
};

type SubmissionReadModel = {
  id: string;
  ownerUserId: string;
  status: SubmissionStatus;
};

export interface SubmissionResultReadRepository {
  findById(id: string): Promise<SubmissionReadModel | null>;
  listAll(): Promise<readonly SubmissionReadModel[]>;
}

export interface JudgeResultReadRepository {
  findBySubmissionId(submissionId: string): Promise<PersistedJudgeResult | null>;
}

export class ResultQueryService {
  constructor(
    private readonly submissions: SubmissionResultReadRepository,
    private readonly results: JudgeResultReadRepository
  ) {}

  async getStudentSubmissionHistory(actorUserId: string): Promise<readonly SubmissionResultView[]> {
    const items = await this.submissions.listAll();
    const owned = items.filter((submission) => submission.ownerUserId === actorUserId);
    const views: SubmissionResultView[] = [];
    for (const submission of owned) {
      views.push(await this.toView(submission));
    }
    return views;
  }

  async getAdminSubmissionDetail(submissionId: string): Promise<SubmissionResultView> {
    const submission = await this.submissions.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    return this.toView(submission);
  }

  private async toView(submission: SubmissionReadModel): Promise<SubmissionResultView> {
    const view: SubmissionResultView = {
      submissionId: submission.id,
      ownerUserId: submission.ownerUserId,
      status: submission.status
    };

    if (submission.status === SubmissionStatus.FINISHED || submission.status === SubmissionStatus.FAILED) {
      const result = await this.results.findBySubmissionId(submission.id);
      if (!result) {
        throw new Error('Result missing for finished submission');
      }
      view.verdict = result.verdict;
      view.timeMs = result.timeMs;
      view.memoryKb = result.memoryKb;
    }

    return view;
  }
}
