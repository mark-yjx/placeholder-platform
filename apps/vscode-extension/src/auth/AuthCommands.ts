import { AuthClient, LoginRequest } from './AuthClient';
import { SessionTokenStore } from './SessionTokenStore';
import { validateLoginInput } from './AuthViews';

export class AuthCommands {
  constructor(
    private readonly authClient: AuthClient,
    private readonly tokenStore: SessionTokenStore
  ) {}

  async login(request: LoginRequest): Promise<void> {
    validateLoginInput(request);
    const response = await this.authClient.login(request);
    await this.tokenStore.setAccessToken(response.accessToken);
  }

  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }
}
