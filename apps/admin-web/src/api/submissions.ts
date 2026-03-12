import { fetchAdminApi, parseJsonResponse, responseDetail } from './client';

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

export async function fetchAdminSubmissions(token: string): Promise<AdminSubmissionListItem[]> {
  const response = await fetchAdminApi('/admin/submissions', {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
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
  const response = await fetchAdminApi(`/admin/submissions/${encodeURIComponent(submissionId)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
    | AdminSubmissionDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin submission detail is unavailable.');
  }

  return body as AdminSubmissionDetail;
}
