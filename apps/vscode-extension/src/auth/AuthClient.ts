export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  email?: string;
  role?: 'admin' | 'student';
};

export interface AuthClient {
  login(request: LoginRequest): Promise<LoginResponse>;
}
