export type SecretStorageLike = {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

const ACCESS_TOKEN_SECRET_KEY = 'oj.auth.accessToken';
const EMAIL_SECRET_KEY = 'oj.auth.email';
const ROLE_SECRET_KEY = 'oj.auth.role';

export type SessionIdentity = {
  email: string | null;
  role: string | null;
};

export class SessionTokenStore {
  private accessToken: string | null = null;
  private email: string | null = null;
  private role: string | null = null;

  constructor(private readonly secrets?: SecretStorageLike) {}

  async hydrate(): Promise<void> {
    if (!this.secrets) {
      return;
    }
    this.accessToken = (await this.secrets.get(ACCESS_TOKEN_SECRET_KEY)) ?? null;
    this.email = (await this.secrets.get(EMAIL_SECRET_KEY)) ?? null;
    this.role = (await this.secrets.get(ROLE_SECRET_KEY)) ?? null;
  }

  async setSession(input: { accessToken: string; email?: string; role?: string }): Promise<void> {
    const accessToken = input.accessToken.trim();
    if (!accessToken) {
      throw new Error('Access token must not be empty');
    }

    const email = input.email?.trim() || null;
    const role = input.role?.trim() || null;

    this.accessToken = accessToken;
    this.email = email;
    this.role = role;

    if (!this.secrets) {
      return;
    }

    await this.secrets.store(ACCESS_TOKEN_SECRET_KEY, accessToken);
    if (email) {
      await this.secrets.store(EMAIL_SECRET_KEY, email);
    } else {
      await this.secrets.delete(EMAIL_SECRET_KEY);
    }
    if (role) {
      await this.secrets.store(ROLE_SECRET_KEY, role);
    } else {
      await this.secrets.delete(ROLE_SECRET_KEY);
    }
  }

  async setAccessToken(token: string): Promise<void> {
    await this.setSession({
      accessToken: token,
      email: this.email ?? undefined,
      role: this.role ?? undefined
    });
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    this.email = null;
    this.role = null;
    if (this.secrets) {
      await this.secrets.delete(ACCESS_TOKEN_SECRET_KEY);
      await this.secrets.delete(EMAIL_SECRET_KEY);
      await this.secrets.delete(ROLE_SECRET_KEY);
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  getSessionIdentity(): SessionIdentity {
    return {
      email: this.email,
      role: this.role
    };
  }
}
