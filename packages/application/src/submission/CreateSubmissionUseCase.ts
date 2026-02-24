import { Problem, Submission } from '@packages/domain/src';
import { ProblemRepository, SubmissionRepository } from '@packages/domain/src/ports';
import { SubmissionPolicyService } from '@packages/domain/src/services';
import { Role } from '@packages/domain/src/identity';

type CreateSubmissionCommand = {
  submissionId: string;
  problemId: string;
  actorRoles: readonly Role[];
  language: string;
};

export class CreateSubmissionUseCase {
  constructor(
    private readonly problems: ProblemRepository,
    private readonly submissions: SubmissionRepository,
    private readonly submissionPolicy: SubmissionPolicyService
  ) {}

  async execute(command: CreateSubmissionCommand): Promise<Submission.Submission> {
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
    await this.submissions.save(submission);
    return submission;
  }
}
