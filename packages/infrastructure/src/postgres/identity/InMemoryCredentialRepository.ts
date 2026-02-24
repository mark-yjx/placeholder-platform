import {
  CredentialRecord,
  CredentialRepository
} from '@packages/application/src/auth/PasswordCredentialAuthService';
import { Role } from '@packages/domain/src/identity';

export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly credentialsByEmail = new Map<string, CredentialRecord>();

  async findByEmail(email: string): Promise<CredentialRecord | null> {
    return this.credentialsByEmail.get(email) ?? null;
  }

  seedCredential(input: {
    userId: string;
    email: string;
    passwordHash: string;
    roles?: readonly Role[];
  }): void {
    this.credentialsByEmail.set(input.email, {
      userId: input.userId,
      email: input.email,
      passwordHash: input.passwordHash,
      roles: input.roles ?? [Role.STUDENT]
    });
  }
}
