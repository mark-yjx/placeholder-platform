import { Problem } from '../problem';

export interface ProblemRepository {
  findById(id: string): Promise<Problem | null>;
  save(problem: Problem): Promise<void>;
}
