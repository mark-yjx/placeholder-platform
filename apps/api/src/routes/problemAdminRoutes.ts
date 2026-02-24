import { ProblemAdminCrudService, ProblemPublicationService } from '@packages/application/src/problem';
import { RbacAuthorizationService } from '@packages/application/src/auth';
import { Role } from '@packages/domain/src/identity';
import { PROBLEM_ADMIN_ROUTE_PERMISSIONS } from './permissionMapping';

type AdminActor = {
  actorUserId: string;
  actorRoles: readonly Role[];
};

type CreateProblemRequest = AdminActor & {
  problemId: string;
  versionId: string;
  title: string;
  statement: string;
};

type UpdateProblemRequest = AdminActor & {
  problemId: string;
  versionId: string;
  title?: string;
  statement?: string;
};

type DeleteProblemRequest = AdminActor & {
  problemId: string;
};

export function createProblemAdminRoutes(
  service: ProblemAdminCrudService,
  publicationService: ProblemPublicationService,
  rbac: RbacAuthorizationService
) {
  return {
    async createProblem(request: CreateProblemRequest): Promise<{ problemId: string }> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: PROBLEM_ADMIN_ROUTE_PERMISSIONS.createProblem
      });
      const problem = await service.create({
        problemId: request.problemId,
        versionId: request.versionId,
        title: request.title,
        statement: request.statement
      });
      return { problemId: problem.id };
    },
    async updateProblem(request: UpdateProblemRequest): Promise<{ problemId: string }> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: PROBLEM_ADMIN_ROUTE_PERMISSIONS.updateProblem
      });
      const problem = await service.update({
        problemId: request.problemId,
        versionId: request.versionId,
        title: request.title,
        statement: request.statement
      });
      return { problemId: problem.id };
    },
    async deleteProblem(request: DeleteProblemRequest): Promise<void> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: PROBLEM_ADMIN_ROUTE_PERMISSIONS.deleteProblem
      });
      await service.delete(request.problemId);
    },
    async publishProblem(request: DeleteProblemRequest): Promise<{ problemId: string }> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: PROBLEM_ADMIN_ROUTE_PERMISSIONS.publishProblem
      });
      const problem = await publicationService.publish(request.problemId);
      return { problemId: problem.id };
    },
    async unpublishProblem(request: DeleteProblemRequest): Promise<{ problemId: string }> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: PROBLEM_ADMIN_ROUTE_PERMISSIONS.unpublishProblem
      });
      const problem = await publicationService.unpublish(request.problemId);
      return { problemId: problem.id };
    }
  };
}
