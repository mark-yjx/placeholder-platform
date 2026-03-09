import type { AdminUser, LoginResponse } from './types';

const DEFAULT_ADMIN_API_BASE_URL = 'http://127.0.0.1:8200';

function adminApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? DEFAULT_ADMIN_API_BASE_URL;
  return configuredBaseUrl.replace(/\/$/, '');
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

export async function loginAdmin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const body = (await parseResponse(response)) as LoginResponse | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(body && 'detail' in body && body.detail ? body.detail : 'Admin login failed.');
  }

  return body as LoginResponse;
}

export async function fetchCurrentAdmin(token: string): Promise<AdminUser> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/me`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as { user?: AdminUser; detail?: string } | null;

  if (!response.ok || !body?.user) {
    throw new Error(body && 'detail' in body && body.detail ? body.detail : 'Admin session is invalid.');
  }

  return body.user;
}
