const ADMIN_TOKEN_KEY = 'oj.admin.token';

export function readStoredAdminToken(): string | null {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function storeAdminToken(token: string): void {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearStoredAdminToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
