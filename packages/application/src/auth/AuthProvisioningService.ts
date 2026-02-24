import { Email, PasswordHash, Role, User } from '@packages/domain/src/identity';

export type InviteRecord = {
  token: string;
  email: string;
  issuedByAdminId: string;
  accepted: boolean;
};

export interface InviteRepository {
  createInvite(invite: InviteRecord): Promise<void>;
  findInviteByToken(token: string): Promise<InviteRecord | null>;
  markInviteAccepted(token: string): Promise<void>;
}

export interface AccountRepository {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

type IssueInviteInput = {
  token: string;
  email: string;
  issuedByAdminId: string;
};

type AcceptInviteInput = {
  token: string;
  passwordHash: string;
};

export class AuthProvisioningService {
  constructor(
    private readonly invites: InviteRepository,
    private readonly accounts: AccountRepository
  ) {}

  async issueInvite(input: IssueInviteInput): Promise<void> {
    const email = Email.create(input.email);
    const existing = await this.accounts.findByEmail(email.toString());
    if (existing) {
      throw new Error('Account already exists');
    }
    await this.invites.createInvite({
      token: input.token,
      email: email.toString(),
      issuedByAdminId: input.issuedByAdminId,
      accepted: false
    });
  }

  async acceptInvite(input: AcceptInviteInput): Promise<User> {
    const invite = await this.invites.findInviteByToken(input.token);
    if (!invite || invite.accepted) {
      throw new Error('Invite is invalid or already used');
    }

    const existing = await this.accounts.findByEmail(invite.email);
    if (existing) {
      throw new Error('Account already exists');
    }

    const user = new User(
      `user-${input.token}`,
      Email.create(invite.email),
      PasswordHash.create(input.passwordHash),
      [Role.STUDENT]
    );

    await this.accounts.save(user);
    await this.invites.markInviteAccepted(input.token);
    return user;
  }
}
