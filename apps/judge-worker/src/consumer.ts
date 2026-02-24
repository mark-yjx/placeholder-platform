import { Judge } from '@packages/contracts/src';

export function consumeJudgeJob(job: Judge.JudgeJob): Judge.JudgeJob {
  Judge.validateJudgeJob(job);
  return job;
}
