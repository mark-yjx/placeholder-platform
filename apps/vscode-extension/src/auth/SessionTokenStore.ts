export type SecretStorageLike = {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

const ACCESS_TOKEN_SECRET_KEY = 'oj.auth.accessToken';

export class SessionTokenStore {
  private accessToken: string | null = null;

  constructor(private readonly secrets?: SecretStorageLike) {}

  async hydrate(): Promise<void> {
    if (!this.secrets) {
      return;
    }
    this.accessToken = (await this.secrets.get(ACCESS_TOKEN_SECRET_KEY)) ?? null;
  }

  async setAccessToken(token: string): Promise<void> {
    if (!token.trim()) {
      throw new Error('Access token must not be empty');
    }
    this.accessToken = token;
    if (this.secrets) {
      await this.secrets.store(ACCESS_TOKEN_SECRET_KEY, token);
    }
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    if (this.secrets) {
      await this.secrets.delete(ACCESS_TOKEN_SECRET_KEY);
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}
