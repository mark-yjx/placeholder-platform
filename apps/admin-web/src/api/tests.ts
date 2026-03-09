export type AdminProblemTestCase = {
  input: string;
  output: string;
};

export type AdminProblemTestsDetail = {
  problemId: string;
  publicTests: AdminProblemTestCase[];
  hiddenTests: AdminProblemTestCase[];
};

export type AdminProblemTestsUpdateRequest = {
  publicTests: AdminProblemTestCase[];
  hiddenTests: AdminProblemTestCase[];
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

export async function fetchAdminProblemTests(
  token: string,
  problemId: string
): Promise<AdminProblemTestsDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/problems/${encodeURIComponent(problemId)}/tests`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );
  const body = (await parseResponse(response)) as
    | AdminProblemTestsDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem tests are unavailable.');
  }

  return body as AdminProblemTestsDetail;
}

export async function updateAdminProblemTests(
  token: string,
  problemId: string,
  payload: AdminProblemTestsUpdateRequest
): Promise<AdminProblemTestsDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/problems/${encodeURIComponent(problemId)}/tests`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  const body = (await parseResponse(response)) as
    | AdminProblemTestsDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem tests update is unavailable.');
  }

  return body as AdminProblemTestsDetail;
}
