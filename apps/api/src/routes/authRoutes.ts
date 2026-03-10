import {
  AuthProvisioningService,
  PasswordCredentialAuthService,
  RbacAuthorizationService
} from '@placeholder/application/src/auth';
import { Role } from '@placeholder/domain/src/identity';
import { AUTH_ROUTE_PERMISSIONS } from './permissionMapping';

type IssueInviteRequest = {
  actorRoles: readonly Role[];
  actorUserId: string;
  email: string;
  inviteToken: string;
};

type AcceptInviteRequest = {
  inviteToken: string;
  passwordHash: string;
};

type PasswordLoginRequest = {
  email: string;
  password: string;
};

export function createAuthRoutes(
  inviteService: AuthProvisioningService,
  passwordAuthService: PasswordCredentialAuthService,
  rbacAuthorizationService: RbacAuthorizationService
) {
  return {
    async issueInvite(request: IssueInviteRequest): Promise<void> {
      await rbacAuthorizationService.assertAdminAccess({
        actorUserId: request.actorUserId,
        actorRoles: request.actorRoles,
        action: AUTH_ROUTE_PERMISSIONS.issueInvite
      });
      await inviteService.issueInvite({
        token: request.inviteToken,
        email: request.email,
        issuedByAdminId: request.actorUserId
      });
    },
    async acceptInvite(request: AcceptInviteRequest): Promise<{ userId: string; email: string }> {
      const user = await inviteService.acceptInvite({
        token: request.inviteToken,
        passwordHash: request.passwordHash
      });
      return { userId: user.id, email: user.email.toString() };
    },
    async loginWithPassword(
      request: PasswordLoginRequest
    ): Promise<{ userId: string; token: string; roles: readonly Role[] }> {
      const session = await passwordAuthService.login({
        email: request.email,
        password: request.password
      });
      return session;
    }
  };
}
