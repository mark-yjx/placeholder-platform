import { JudgeResult } from '../judge';

export interface JudgeResultRepository {
  findBySubmissionId(submissionId: string): Promise<JudgeResult | null>;
  save(result: JudgeResult): Promise<void>;
}
