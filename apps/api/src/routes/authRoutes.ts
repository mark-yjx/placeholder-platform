import { AuthProvisioningService } from '@packages/application/src/auth';
import { Role } from '@packages/domain/src/identity';

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

export function createAuthRoutes(service: AuthProvisioningService) {
  return {
    async issueInvite(request: IssueInviteRequest): Promise<void> {
      if (!request.actorRoles.includes(Role.ADMIN)) {
        throw new Error('Forbidden');
      }
      await service.issueInvite({
        token: request.inviteToken,
        email: request.email,
        issuedByAdminId: request.actorUserId
      });
    },
    async acceptInvite(request: AcceptInviteRequest): Promise<{ userId: string; email: string }> {
      const user = await service.acceptInvite({
        token: request.inviteToken,
        passwordHash: request.passwordHash
      });
      return { userId: user.id, email: user.email.toString() };
    }
  };
}
