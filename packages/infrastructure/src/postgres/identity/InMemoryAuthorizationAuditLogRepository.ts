import {
  AuthorizationAuditLogRepository,
  AuthorizationDenialAuditRecord
} from '@placeholder/application/src/auth/RbacAuthorizationService';

export class InMemoryAuthorizationAuditLogRepository implements AuthorizationAuditLogRepository {
  private readonly denials: AuthorizationDenialAuditRecord[] = [];

  async recordDenial(record: AuthorizationDenialAuditRecord): Promise<void> {
    this.denials.push(record);
  }

  listDenials(): readonly AuthorizationDenialAuditRecord[] {
    return [...this.denials];
  }
}
