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

function responseDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return null;
  }

  const detail = body.detail;
  return typeof detail === 'string' ? detail : null;
}

export type AdminUserListItem = {
  userId: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
};

export type AdminUserDetail = AdminUserListItem & {
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AdminUserCreateRequest = {
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  status: 'active' | 'disabled';
  password: string;
};

export type AdminUserUpdateRequest = {
  displayName: string;
  role: 'student' | 'admin';
  status: 'active' | 'disabled';
};

export async function fetchAdminUsers(token: string): Promise<AdminUserListItem[]> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/users`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as AdminUserListItem[] | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin users list is unavailable.');
  }

  return Array.isArray(body) ? body : [];
}

export async function fetchAdminUser(token: string, userId: string): Promise<AdminUserDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user detail is unavailable.');
  }

  return body as AdminUserDetail;
}

export async function createAdminUser(
  token: string,
  payload: AdminUserCreateRequest
): Promise<AdminUserDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/users`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user creation is unavailable.');
  }

  return body as AdminUserDetail;
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: AdminUserUpdateRequest
): Promise<AdminUserDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user update is unavailable.');
  }

  return body as AdminUserDetail;
}

export async function enableAdminUser(token: string, userId: string): Promise<AdminUserDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/enable`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user status update is unavailable.');
  }

  return body as AdminUserDetail;
}

export async function disableAdminUser(token: string, userId: string): Promise<AdminUserDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/disable`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user status update is unavailable.');
  }

  return body as AdminUserDetail;
}

export async function setAdminUserPassword(
  token: string,
  userId: string,
  password: string
): Promise<AdminUserDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/password`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ password })
    }
  );
  const body = (await parseResponse(response)) as AdminUserDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin user password update is unavailable.');
  }

  return body as AdminUserDetail;
}
