import { Submission } from '../submission';

export interface SubmissionRepository {
  findById(id: string): Promise<Submission | null>;
  save(submission: Submission): Promise<void>;
}
