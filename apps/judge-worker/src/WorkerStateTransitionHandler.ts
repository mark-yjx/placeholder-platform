import { Judge } from '@placeholder/contracts/src';
import { createWorkerLogger } from './observability/WorkerLogger';

export type WorkerSubmissionStatus = 'queued' | 'running' | 'finished' | 'failed';

export type WorkerSubmissionRecord = {
  id: string;
  ownerUserId: string;
  problemId: string;
  problemVersionId: string;
  language: string;
  sourceCode: string;
  status: WorkerSubmissionStatus;
};

export interface WorkerJudgeJobQueue {
  claimNext(): Promise<Judge.JudgeJob | null>;
  acknowledge(submissionId: string): Promise<void>;
}

export interface WorkerSubmissionRepository {
  findById(id: string): Promise<WorkerSubmissionRecord | null>;
  save(record: WorkerSubmissionRecord): Promise<void>;
}

export type WorkerExecutionResult = {
  status: 'finished' | 'failed';
};

export interface WorkerExecutionService {
  execute(job: Judge.JudgeJob): Promise<WorkerExecutionResult>;
}

export type WorkerProcessNextResult =
  | { outcome: 'idle' }
  | { outcome: 'processed'; submissionId: string; status: 'finished' | 'failed' };

export async function processNextJudgeJob(input: {
  queue: WorkerJudgeJobQueue;
  submissions: WorkerSubmissionRepository;
  execution: WorkerExecutionService;
}): Promise<WorkerProcessNextResult> {
  const job = await input.queue.claimNext();
  if (!job) {
    return { outcome: 'idle' };
  }

  Judge.validateJudgeJob(job);

  const logger = createWorkerLogger(job.submissionId);
  logger.info('worker.job.claimed', {
    submissionId: job.submissionId,
    ownerUserId: job.ownerUserId,
    problemId: job.problemId
  });

  const submission = await input.submissions.findById(job.submissionId);
  if (!submission) {
    throw new Error(`Submission not found for job ${job.submissionId}`);
  }

  await input.submissions.save({
    ...submission,
    status: 'running'
  });
  logger.info('worker.submission.running', {
    submissionId: job.submissionId,
    status: 'running'
  });

  const executionResult = await input.execution.execute(job);

  await input.submissions.save({
    ...submission,
    status: executionResult.status
  });
  logger.info('worker.submission.completed', {
    submissionId: job.submissionId,
    status: executionResult.status
  });

  await input.queue.acknowledge(job.submissionId);

  return {
    outcome: 'processed',
    submissionId: job.submissionId,
    status: executionResult.status
  };
}
