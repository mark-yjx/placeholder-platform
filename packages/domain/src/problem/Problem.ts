import { ProblemVersion } from './ProblemVersion';

export class Problem {
  private readonly versionsList: ProblemVersion[];

  constructor(
    public readonly id: string,
    versions: readonly ProblemVersion[]
  ) {
    if (id.trim().length === 0) {
      throw new Error('Problem id is required');
    }
    if (versions.length === 0) {
      throw new Error('At least one problem version is required');
    }
    this.versionsList = [...versions];
  }

  get versions(): readonly ProblemVersion[] {
    return [...this.versionsList];
  }

  get latestVersion(): ProblemVersion {
    return this.versionsList[this.versionsList.length - 1];
  }

  publishLatestVersion(): ProblemVersion {
    const latestIndex = this.versionsList.length - 1;
    const published = this.versionsList[latestIndex].publish();
    this.versionsList[latestIndex] = published;
    return published;
  }

  createEditedVersion(
    nextVersionId: string,
    changes: Partial<Pick<ProblemVersion, 'title' | 'statement'>>
  ): ProblemVersion {
    const next = this.latestVersion.fork(nextVersionId, changes);
    this.versionsList.push(next);
    return next;
  }
}
