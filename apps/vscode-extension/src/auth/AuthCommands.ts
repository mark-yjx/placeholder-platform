import { AuthClient, BrowserAuthMode, BrowserAuthUrlInput, LoginRequest, LoginResponse } from './AuthClient';
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
    await this.persistStudentSession(response, request.email.trim());
    return this.tokenStore.getSessionIdentity();
  }

  getBrowserAuthUrl(mode: BrowserAuthMode, input?: BrowserAuthUrlInput): string {
    return this.authClient.getBrowserAuthUrl(mode, input);
  }

  async completeBrowserAuth(code: string): Promise<{ email: string | null; role: string | null }> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new Error('Sign-in code is required');
    }

    const response = await this.authClient.exchangeBrowserCode({ code: normalizedCode });
    await this.persistStudentSession(response, response.email ?? null);
    return this.tokenStore.getSessionIdentity();
  }

  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  private async persistStudentSession(
    response: LoginResponse,
    fallbackEmail: string | null
  ): Promise<void> {
    if (response.role === 'admin') {
      await this.tokenStore.clear();
      throw new StudentOnlyExtensionError();
    }
    await this.tokenStore.setSession({
      accessToken: response.accessToken,
      email: response.email ?? fallbackEmail ?? undefined,
      role: response.role
    });
  }
}
