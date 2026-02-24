import { SessionTokenIssuer } from '@packages/application/src/auth/PasswordCredentialAuthService';

export class InMemorySessionTokenIssuer implements SessionTokenIssuer {
  async issue(input: { userId: string }): Promise<string> {
    return `session-${input.userId}`;
  }
}
