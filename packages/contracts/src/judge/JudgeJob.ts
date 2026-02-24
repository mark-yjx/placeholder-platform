export type JudgeJob = {
  submissionId: string;
  ownerUserId: string;
  problemId: string;
  problemVersionId: string;
  language: string;
  sourceCode: string;
};

export function validateJudgeJob(job: JudgeJob): void {
  if (job.submissionId.trim().length === 0) {
    throw new Error('Invalid judge job: submissionId is required');
  }
  if (job.ownerUserId.trim().length === 0) {
    throw new Error('Invalid judge job: ownerUserId is required');
  }
  if (job.problemId.trim().length === 0) {
    throw new Error('Invalid judge job: problemId is required');
  }
  if (job.problemVersionId.trim().length === 0) {
    throw new Error('Invalid judge job: problemVersionId is required');
  }
  if (job.language.trim().length === 0) {
    throw new Error('Invalid judge job: language is required');
  }
  if (job.sourceCode.trim().length === 0) {
    throw new Error('Invalid judge job: sourceCode is required');
  }
}
