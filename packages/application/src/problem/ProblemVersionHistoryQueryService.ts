import { PublicationState } from '@placeholder/domain/src/problem';

export type ProblemVersionTimelineEntry = {
  versionId: string;
  versionNumber: number;
  title: string;
  publicationState: PublicationState;
};

export interface ProblemVersionHistoryRepository {
  findVersionTimeline(problemId: string): Promise<readonly ProblemVersionTimelineEntry[]>;
}

export class ProblemVersionHistoryQueryService {
  constructor(private readonly problems: ProblemVersionHistoryRepository) {}

  async getVersionHistory(problemId: string): Promise<readonly ProblemVersionTimelineEntry[]> {
    const timeline = await this.problems.findVersionTimeline(problemId);
    if (timeline.length === 0) {
      throw new Error('Problem not found');
    }
    return [...timeline].sort((left, right) => left.versionNumber - right.versionNumber);
  }
}
