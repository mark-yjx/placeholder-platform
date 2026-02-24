import { ResourceUsage } from './ResourceUsage';
import { Verdict } from './Verdict';

type JudgeResultProps = {
  submissionId: string;
  verdict: Verdict;
  resourceUsage: ResourceUsage;
};

export class JudgeResult {
  readonly submissionId: string;
  readonly verdict: Verdict;
  readonly resourceUsage: ResourceUsage;

  private constructor(props: JudgeResultProps) {
    if (props.submissionId.trim().length === 0) {
      throw new Error('JudgeResult submissionId is required');
    }

    this.submissionId = props.submissionId;
    this.verdict = props.verdict;
    this.resourceUsage = props.resourceUsage;
    Object.freeze(this);
  }

  static create(props: JudgeResultProps): JudgeResult {
    return new JudgeResult(props);
  }
}
