import { RbacAuthorizationService } from '@placeholder/application/src/auth';
import { ResultQueryService } from '@placeholder/application/src/results';
import { Role } from '@placeholder/domain/src/identity';
import { SUBMISSION_ADMIN_ROUTE_PERMISSIONS } from './permissionMapping';

type ActorRequest = {
  actorUserId: string;
  actorRoles: readonly Role[];
};

export function createResultRoutes(query: ResultQueryService, rbac: RbacAuthorizationService) {
  return {
    async getStudentSubmissionHistory(request: ActorRequest) {
      if (!request.actorRoles.includes(Role.STUDENT)) {
        throw new Error('Forbidden');
      }
      return query.getStudentSubmissionHistory(request.actorUserId);
    },
    async getAdminSubmissionResult(request: ActorRequest & { submissionId: string }) {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: SUBMISSION_ADMIN_ROUTE_PERMISSIONS.viewSubmissionResult
      });
      return query.getAdminSubmissionDetail(request.submissionId);
    }
  };
}
