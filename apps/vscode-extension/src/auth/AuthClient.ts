export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
};

export interface AuthClient {
  login(request: LoginRequest): Promise<LoginResponse>;
}
