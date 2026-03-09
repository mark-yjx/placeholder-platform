import { AuthClient, LoginRequest } from './AuthClient';
import { SessionTokenStore } from './SessionTokenStore';
import { validateLoginInput } from './AuthViews';

export const STUDENT_ONLY_EXTENSION_MESSAGE =
  'Administrators must use Web Admin. The VS Code extension is student-only.';

export class StudentOnlyExtensionError extends Error {
  constructor() {
    super(STUDENT_ONLY_EXTENSION_MESSAGE);
    this.name = 'StudentOnlyExtensionError';
  }
}

export class AuthCommands {
  constructor(
    private readonly authClient: AuthClient,
    private readonly tokenStore: SessionTokenStore
  ) {}

  async login(request: LoginRequest): Promise<{ email: string | null; role: string | null }> {
    validateLoginInput(request);
    const response = await this.authClient.login(request);
    if (response.role === 'admin') {
      await this.tokenStore.clear();
      throw new StudentOnlyExtensionError();
    }
    await this.tokenStore.setSession({
      accessToken: response.accessToken,
      email: response.email ?? request.email.trim(),
      role: response.role
    });
    return this.tokenStore.getSessionIdentity();
  }

  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }
}
