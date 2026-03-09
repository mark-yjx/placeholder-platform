import type {
  AdminSessionState,
  SessionResponse,
  TotpEnrollment
} from './types';

const DEFAULT_ADMIN_API_BASE_URL = 'http://127.0.0.1:8200';

export function adminApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? DEFAULT_ADMIN_API_BASE_URL;
  return configuredBaseUrl.replace(/\/$/, '');
}

function authHeaders(token?: string | null): HeadersInit {
  if (!token) {
    return {};
  }

  return {
    authorization: `Bearer ${token}`
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function responseDetail(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return fallback;
  }

  return typeof body.detail === 'string' ? body.detail : fallback;
}

export function microsoftLoginUrl(): string {
  return `${adminApiBaseUrl()}/admin/auth/login/microsoft`;
}

export async function fetchCurrentAdmin(token?: string | null): Promise<AdminSessionState> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/me`, {
    headers: authHeaders(token)
  });
  const body = (await parseResponse(response)) as
    | AdminSessionState
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body, 'Admin session is invalid.'));
  }

  return {
    state: body && 'state' in body ? body.state : 'unauthenticated',
    user:
      body && 'user' in body && body.user
        ? (body.user as AdminSessionState['user'])
        : null,
    pendingExpiresAt:
      body && 'pendingExpiresAt' in body ? (body.pendingExpiresAt ?? null) : null
  };
}

export async function verifyAdminTotp(
  token: string,
  code: string
): Promise<SessionResponse> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/totp/verify`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({ code })
  });
  const body = (await parseResponse(response)) as SessionResponse | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body, 'TOTP verification failed.'));
  }

  return body as SessionResponse;
}

export async function initTotpEnrollment(token: string): Promise<TotpEnrollment> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/totp/enroll/init`, {
    method: 'POST',
    headers: authHeaders(token)
  });
  const body = (await parseResponse(response)) as TotpEnrollment | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body, 'TOTP enrollment is unavailable.'));
  }

  return body as TotpEnrollment;
}

export async function confirmTotpEnrollment(token: string, code: string): Promise<void> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/totp/enroll/confirm`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({ code })
  });
  const body = (await parseResponse(response)) as { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body, 'TOTP enrollment confirmation failed.'));
  }
}

export async function logoutAdmin(token?: string | null): Promise<void> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/auth/logout`, {
    method: 'POST',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    const body = (await parseResponse(response)) as { detail?: string } | null;
    throw new Error(responseDetail(body, 'Admin logout failed.'));
  }
}
