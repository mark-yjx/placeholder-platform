export type AdminProblemListItem = {
  problemId: string;
  title: string;
  visibility: string;
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
    throw new Error(
      body && !Array.isArray(body) && body.detail
        ? body.detail
        : 'Admin problems list is unavailable.'
    );
  }

  return Array.isArray(body) ? body : [];
}
