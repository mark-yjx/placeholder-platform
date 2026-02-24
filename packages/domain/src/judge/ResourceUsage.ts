type ResourceUsageProps = {
  timeMs: number;
  memoryKb: number;
};

export class ResourceUsage {
  readonly timeMs: number;
  readonly memoryKb: number;

  private constructor(props: ResourceUsageProps) {
    if (props.timeMs < 0) {
      throw new Error('ResourceUsage timeMs must be non-negative');
    }
    if (props.memoryKb < 0) {
      throw new Error('ResourceUsage memoryKb must be non-negative');
    }

    this.timeMs = props.timeMs;
    this.memoryKb = props.memoryKb;
    Object.freeze(this);
  }

  static create(props: ResourceUsageProps): ResourceUsage {
    return new ResourceUsage(props);
  }
}
