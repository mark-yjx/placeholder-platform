export type LoginRequest = {
  email: string;
  password: string;
};

export type BrowserAuthMode = 'sign-in' | 'sign-up';

export type LoginResponse = {
  accessToken: string;
  email?: string;
  role?: 'admin' | 'student';
};

export interface AuthClient {
  login(request: LoginRequest): Promise<LoginResponse>;
  getBrowserAuthUrl(mode: BrowserAuthMode): string;
  exchangeBrowserCode(input: { code: string }): Promise<LoginResponse>;
}
