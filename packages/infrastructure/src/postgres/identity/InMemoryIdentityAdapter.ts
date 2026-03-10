import { User } from '@placeholder/domain/src/identity';
import {
  AccountRepository,
  InviteRecord,
  InviteRepository
} from '@placeholder/application/src/auth/AuthProvisioningService';

export class InMemoryIdentityAdapter implements InviteRepository, AccountRepository {
  private readonly invitesByToken = new Map<string, InviteRecord>();
  private readonly usersByEmail = new Map<string, User>();

  async createInvite(invite: InviteRecord): Promise<void> {
    this.invitesByToken.set(invite.token, { ...invite });
  }

  async findInviteByToken(token: string): Promise<InviteRecord | null> {
    return this.invitesByToken.get(token) ?? null;
  }

  async markInviteAccepted(token: string): Promise<void> {
    const invite = this.invitesByToken.get(token);
    if (!invite) return;
    this.invitesByToken.set(token, { ...invite, accepted: true });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async save(user: User): Promise<void> {
    this.usersByEmail.set(user.email.toString(), user);
  }
}
