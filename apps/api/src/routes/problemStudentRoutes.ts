import { StudentProblemQueryService } from '@packages/application/src/problem';
import { Role } from '@packages/domain/src/identity';

type StudentActor = {
  actorRoles: readonly Role[];
};

export function createProblemStudentRoutes(service: StudentProblemQueryService) {
  return {
    async listProblems(request: StudentActor) {
      if (!request.actorRoles.includes(Role.STUDENT)) {
        throw new Error('Forbidden');
      }
      return service.listPublishedProblems();
    },
    async getProblemDetail(request: StudentActor & { problemId: string }) {
      if (!request.actorRoles.includes(Role.STUDENT)) {
        throw new Error('Forbidden');
      }
      return service.getPublishedProblemDetail(request.problemId);
    }
  };
}
