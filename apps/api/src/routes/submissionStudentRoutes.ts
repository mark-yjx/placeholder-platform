import { CreateSubmissionUseCase } from '@packages/application/src/submission/CreateSubmissionUseCase';
import { Role } from '@packages/domain/src/identity';

type CreateSubmissionRequest = {
  submissionId: string;
  actorUserId: string;
  actorRoles: readonly Role[];
  problemId: string;
  language: string;
  sourceCode: string;
};

export function createSubmissionStudentRoutes(createSubmission: CreateSubmissionUseCase) {
  return {
    async createSubmission(request: CreateSubmissionRequest): Promise<{
      submissionId: string;
      status: string;
      ownerUserId: string;
      problemVersionId: string;
      enqueueAccepted: true;
    }> {
      const record = await createSubmission.execute({
        submissionId: request.submissionId,
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        problemId: request.problemId,
        language: request.language,
        sourceCode: request.sourceCode
      });

      return {
        submissionId: record.id,
        status: record.status,
        ownerUserId: record.ownerUserId,
        problemVersionId: record.problemVersionId,
        enqueueAccepted: true
      };
    }
  };
}
