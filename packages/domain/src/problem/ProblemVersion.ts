import { PublicationState } from './PublicationState';

type ProblemVersionProps = {
  id: string;
  versionNumber: number;
  title: string;
  statement: string;
  publicationState: PublicationState;
};

export class ProblemVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly statement: string;
  readonly publicationState: PublicationState;

  private constructor(props: ProblemVersionProps) {
    if (props.id.trim().length === 0) {
      throw new Error('ProblemVersion id is required');
    }
    if (props.versionNumber <= 0) {
      throw new Error('ProblemVersion number must be positive');
    }
    if (props.title.trim().length === 0) {
      throw new Error('ProblemVersion title is required');
    }
    if (props.statement.trim().length === 0) {
      throw new Error('ProblemVersion statement is required');
    }

    this.id = props.id;
    this.versionNumber = props.versionNumber;
    this.title = props.title;
    this.statement = props.statement;
    this.publicationState = props.publicationState;

    Object.freeze(this);
  }

  static createDraft(props: Omit<ProblemVersionProps, 'publicationState'>): ProblemVersion {
    return new ProblemVersion({ ...props, publicationState: PublicationState.DRAFT });
  }

  publish(): ProblemVersion {
    return new ProblemVersion({
      id: this.id,
      versionNumber: this.versionNumber,
      title: this.title,
      statement: this.statement,
      publicationState: PublicationState.PUBLISHED
    });
  }

  fork(
    nextVersionId: string,
    changes: Partial<Pick<ProblemVersion, 'title' | 'statement'>>
  ): ProblemVersion {
    return ProblemVersion.createDraft({
      id: nextVersionId,
      versionNumber: this.versionNumber + 1,
      title: changes.title ?? this.title,
      statement: changes.statement ?? this.statement
    });
  }
}
