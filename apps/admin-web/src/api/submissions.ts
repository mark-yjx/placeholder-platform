export type AdminSubmissionListItem = {
  submissionId: string;
  ownerUserId: string;
  problemId: string;
  status: 'queued' | 'running' | 'finished' | 'failed';
  verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | null;
  timeMs: number | null;
  memoryKb: number | null;
  submittedAt: string;
};

export type AdminSubmissionDetail = AdminSubmissionListItem & {
  failureReason: string | null;
  errorDetail: string | null;
  sourceSnapshot: string | null;
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

export async function fetchAdminSubmissions(token: string): Promise<AdminSubmissionListItem[]> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/submissions`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as
    | AdminSubmissionListItem[]
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin submissions list is unavailable.');
  }

  return Array.isArray(body) ? body : [];
}

export async function fetchAdminSubmission(
  token: string,
  submissionId: string
): Promise<AdminSubmissionDetail> {
  const response = await fetch(
    `${adminApiBaseUrl()}/admin/submissions/${encodeURIComponent(submissionId)}`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );
  const body = (await parseResponse(response)) as AdminSubmissionDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin submission detail is unavailable.');
  }

  return body as AdminSubmissionDetail;
}
