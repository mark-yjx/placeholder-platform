import { RbacAuthorizationService } from '@placeholder/application/src/auth';
import { AdminSubmissionManagementService } from '@placeholder/application/src/submission/AdminSubmissionManagementService';
import { Role } from '@placeholder/domain/src/identity';
import { SUBMISSION_ADMIN_ROUTE_PERMISSIONS } from './permissionMapping';

type AdminRequest = {
  actorUserId: string;
  actorRoles: readonly Role[];
};

export function createSubmissionAdminRoutes(
  service: AdminSubmissionManagementService,
  rbac: RbacAuthorizationService
) {
  return {
    async viewSubmissions(request: AdminRequest) {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: SUBMISSION_ADMIN_ROUTE_PERMISSIONS.viewSubmissions
      });
      return service.view(request.actorUserId);
    },
    async rejudgeSubmission(request: AdminRequest & { submissionId: string }) {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: SUBMISSION_ADMIN_ROUTE_PERMISSIONS.rejudgeSubmission
      });
      return service.rejudge(request.actorUserId, request.submissionId);
    },
    async deleteSubmission(request: AdminRequest & { submissionId: string }) {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: SUBMISSION_ADMIN_ROUTE_PERMISSIONS.deleteSubmission
      });
      await service.delete(request.actorUserId, request.submissionId);
    },
    async exportSubmissions(request: AdminRequest): Promise<string> {
      await rbac.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: SUBMISSION_ADMIN_ROUTE_PERMISSIONS.exportSubmissions
      });
      return service.export(request.actorUserId);
    }
  };
}
