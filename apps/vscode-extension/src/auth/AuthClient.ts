export type LoginRequest = {
  email: string;
  password: string;
};

export type BrowserAuthMode = 'sign-in' | 'sign-up';

export type BrowserAuthUrlInput = {
  callbackUri: string;
  state: string;
};

export type LoginResponse = {
  accessToken: string;
  email?: string;
  role?: 'admin' | 'student';
};

export interface AuthClient {
  login(request: LoginRequest): Promise<LoginResponse>;
  getBrowserAuthUrl(mode: BrowserAuthMode, input?: BrowserAuthUrlInput): string;
  exchangeBrowserCode(input: { code: string }): Promise<LoginResponse>;
}
