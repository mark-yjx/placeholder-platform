import { Role } from '@placeholder/domain/src/identity';
import { AuthorizationPolicyService } from '@placeholder/domain/src/services';

export type AuthorizationDenialAuditRecord = {
  actorUserId: string;
  action: string;
  reason: string;
  occurredAt: string;
};

export interface AuthorizationAuditLogRepository {
  recordDenial(record: AuthorizationDenialAuditRecord): Promise<void>;
}

type AssertAdminAccessInput = {
  actorUserId: string;
  actorRoles: readonly Role[];
  action: string;
};

export class RbacAuthorizationService {
  constructor(
    private readonly policy: AuthorizationPolicyService,
    private readonly auditLogs: AuthorizationAuditLogRepository
  ) {}

  async assertAdminAccess(input: AssertAdminAccessInput): Promise<void> {
    if (this.policy.canAccessAdmin(input.actorRoles)) {
      return;
    }

    await this.auditLogs.recordDenial({
      actorUserId: input.actorUserId,
      action: input.action,
      reason: 'Forbidden',
      occurredAt: new Date().toISOString()
    });
    throw new Error('Forbidden');
  }
}
