import {
  fetchAdminApi,
  parseJsonResponse,
  resolveAdminApiBaseUrl,
  responseDetail
} from '../api/client';
import type {
  AdminSessionState,
  SessionResponse,
  TotpEnrollment
} from './types';

function authHeaders(token?: string | null): HeadersInit {
  if (!token) {
    return {};
  }

  return {
    authorization: `Bearer ${token}`
  };
}

export function microsoftLoginUrl(): string {
  return `${resolveAdminApiBaseUrl()}/admin/auth/login/microsoft`;
}

export async function loginAdminLocal(
  email: string,
  password: string
): Promise<SessionResponse> {
  const response = await fetchAdminApi('/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const body = (await parseJsonResponse(response)) as SessionResponse | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin login failed.');
  }

  return body as SessionResponse;
}

export async function fetchCurrentAdmin(token?: string | null): Promise<AdminSessionState> {
  const response = await fetchAdminApi('/admin/auth/me', {
    headers: authHeaders(token)
  });
  const body = (await parseJsonResponse(response)) as
    | AdminSessionState
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin session is invalid.');
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
  const response = await fetchAdminApi('/admin/auth/totp/verify', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({ code })
  });
  const body = (await parseJsonResponse(response)) as SessionResponse | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'TOTP verification failed.');
  }

  return body as SessionResponse;
}

export async function initTotpEnrollment(token: string): Promise<TotpEnrollment> {
  const response = await fetchAdminApi('/admin/auth/totp/enroll/init', {
    method: 'POST',
    headers: authHeaders(token)
  });
  const body = (await parseJsonResponse(response)) as TotpEnrollment | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'TOTP enrollment is unavailable.');
  }

  return body as TotpEnrollment;
}

export async function confirmTotpEnrollment(token: string, code: string): Promise<void> {
  const response = await fetchAdminApi('/admin/auth/totp/enroll/confirm', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({ code })
  });
  const body = (await parseJsonResponse(response)) as { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'TOTP enrollment confirmation failed.');
  }
}

export async function logoutAdmin(token?: string | null): Promise<void> {
  const response = await fetchAdminApi('/admin/auth/logout', {
    method: 'POST',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    const body = (await parseJsonResponse(response)) as { detail?: string } | null;
    throw new Error(responseDetail(body) ?? 'Admin logout failed.');
  }
}
