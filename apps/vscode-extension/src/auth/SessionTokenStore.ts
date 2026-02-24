export class SessionTokenStore {
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    if (!token.trim()) {
      throw new Error('Access token must not be empty');
    }
    this.accessToken = token;
  }

  clear(): void {
    this.accessToken = null;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}
