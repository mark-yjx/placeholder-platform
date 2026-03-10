import { Problem, Submission } from '@placeholder/domain/src';
import { ProblemRepository } from '@placeholder/domain/src/ports';
import { SubmissionPolicyService } from '@placeholder/domain/src/services';
import { Role } from '@placeholder/domain/src/identity';
import { SubmissionStatus } from '@placeholder/domain/src/submission';
import { Judge } from '@placeholder/contracts/src';

export type SubmissionRecord = {
  id: string;
  ownerUserId: string;
  problemId: string;
  problemVersionId: string;
  language: string;
  sourceCode: string;
  status: SubmissionStatus;
  failureReason?: string;
};

export interface SubmissionCreationRepository {
  findById(id: string): Promise<SubmissionRecord | null>;
  save(record: SubmissionRecord): Promise<void>;
}

export interface JudgeJobQueue {
  enqueue(job: Judge.JudgeJob): Promise<void>;
}

type CreateSubmissionCommand = {
  submissionId: string;
  actorUserId: string;
  problemId: string;
  actorRoles: readonly Role[];
  language: string;
  sourceCode: string;
};

export class CreateSubmissionUseCase {
  constructor(
    private readonly problems: ProblemRepository,
    private readonly submissions: SubmissionCreationRepository,
    private readonly judgeQueue: JudgeJobQueue,
    private readonly submissionPolicy: SubmissionPolicyService
  ) {}

  async execute(command: CreateSubmissionCommand): Promise<SubmissionRecord> {
    const commandValidationError = this.validateCommand(command);
    if (commandValidationError) {
      throw new Error(commandValidationError);
    }

    const problem = await this.problems.findById(command.problemId);
    if (!problem) {
      throw new Error('Problem not found');
    }

    const isPublished = this.submissionPolicy.isPublishedState(
      problem.latestVersion.publicationState as Problem.PublicationState
    );
    const decision = this.submissionPolicy.evaluate({
      actorRoles: command.actorRoles,
      isProblemPublished: isPublished,
      language: command.language
    });

    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    const submission = Submission.Submission.createQueued(command.submissionId);
    const record: SubmissionRecord = {
      id: submission.id,
      ownerUserId: command.actorUserId,
      problemId: problem.id,
      problemVersionId: problem.latestVersion.id,
      language: command.language,
      sourceCode: command.sourceCode,
      status: submission.status,
      failureReason: undefined
    };
    await this.submissions.save(record);
    const judgeJob: Judge.JudgeJob = {
      submissionId: record.id,
      ownerUserId: record.ownerUserId,
      problemId: record.problemId,
      problemVersionId: record.problemVersionId,
      language: record.language,
      sourceCode: record.sourceCode
    };
    Judge.validateJudgeJob(judgeJob);
    await this.judgeQueue.enqueue(judgeJob);
    return record;
  }

  private validateCommand(command: CreateSubmissionCommand): string | null {
    if (command.actorUserId.trim().length === 0) {
      return 'Authentication required';
    }
    if (command.problemId.trim().length === 0) {
      return 'Problem id is required';
    }
    if (command.sourceCode.trim().length === 0) {
      return 'Source code is required';
    }
    return null;
  }
}
