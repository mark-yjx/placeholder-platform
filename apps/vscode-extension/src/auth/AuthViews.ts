import { LoginRequest } from './AuthClient';

export type LoginViewModel = {
  title: string;
  fields: readonly ['email', 'password'];
};

export function createLoginViewModel(): LoginViewModel {
  return {
    title: 'Student Login',
    fields: ['email', 'password']
  };
}

export function validateLoginInput(input: LoginRequest): void {
  if (!input.email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (!input.password.trim()) {
    throw new Error('Password is required');
  }
}
