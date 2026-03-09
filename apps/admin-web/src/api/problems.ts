export type AdminProblemListItem = {
  problemId: string;
  title: string;
  visibility: string;
  updatedAt: string;
};

export type AdminProblemVisibility = 'draft' | 'public' | 'private';

export type AdminProblemCreateRequest = {
  problemId: string;
  title: string;
  entryFunction: string;
  language: 'python';
  timeLimitMs: number;
  memoryLimitKb: number;
};

export type AdminProblemDetail = {
  problemId: string;
  title: string;
  entryFunction: string;
  language: 'python';
  timeLimitMs: number;
  memoryLimitKb: number;
  visibility: AdminProblemVisibility;
  statementMarkdown: string;
  starterCode: string;
  updatedAt: string;
};

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

export async function fetchAdminProblems(token: string): Promise<AdminProblemListItem[]> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/problems`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as
    | AdminProblemListItem[]
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problems list is unavailable.');
  }

  return Array.isArray(body) ? body : [];
}

export async function fetchAdminProblem(
  token: string,
  problemId: string
): Promise<AdminProblemDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/problems/${encodeURIComponent(problemId)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as AdminProblemDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem detail is unavailable.');
  }

  return body as AdminProblemDetail;
}

export async function createAdminProblem(
  token: string,
  payload: AdminProblemCreateRequest
): Promise<AdminProblemDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/problems`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseResponse(response)) as AdminProblemDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem creation is unavailable.');
  }

  return body as AdminProblemDetail;
}

export async function updateAdminProblem(
  token: string,
  problemId: string,
  payload: AdminProblemDetail
): Promise<AdminProblemDetail> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/problems/${encodeURIComponent(problemId)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseResponse(response)) as AdminProblemDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem update is unavailable.');
  }

  return body as AdminProblemDetail;
}
