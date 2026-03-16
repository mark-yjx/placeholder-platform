import { fetchAdminApi, parseJsonResponse, responseDetail } from './client';

export type AdminProblemListItem = {
  problemId: string;
  title: string;
  visibility: string;
  updatedAt: string;
};

export type AdminProblemVisibility =
  | 'draft'
  | 'published'
  | 'archived'
  | 'public'
  | 'private';

export type AdminProblemPreviewCase = {
  input: unknown;
  output: unknown;
};

export type AdminProblemExampleCase = {
  input: unknown;
  output: unknown;
};

export type AdminProblemPreview = {
  problemId: string;
  title: string;
  statementMarkdown: string;
  examples: AdminProblemPreviewCase[];
  publicTests: AdminProblemPreviewCase[];
};

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
  examples: AdminProblemExampleCase[];
  starterCode: string;
  updatedAt: string;
};

function publishReadinessDetail(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('error' in body) ||
    body.error !== 'problem_not_ready'
  ) {
    return null;
  }

  const payload = body as { missing?: unknown };
  const missing = Array.isArray(payload.missing)
    ? payload.missing.filter((item): item is string => typeof item === 'string')
    : [];
  return missing.length > 0
    ? `Problem is not ready to publish: ${missing.join(', ')}.`
    : 'Problem is not ready to publish.';
}

export async function fetchAdminProblems(token: string): Promise<AdminProblemListItem[]> {
  const response = await fetchAdminApi('/admin/problems', {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
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
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as AdminProblemDetail | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem detail is unavailable.');
  }

  return body as AdminProblemDetail;
}

export async function fetchAdminProblemPreview(
  token: string,
  problemId: string
): Promise<AdminProblemPreview> {
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}/preview`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
    | AdminProblemPreview
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem preview is unavailable.');
  }

  return body as AdminProblemPreview;
}

export async function createAdminProblem(
  token: string,
  payload: AdminProblemCreateRequest
): Promise<AdminProblemDetail> {
  const response = await fetchAdminApi('/admin/problems', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseJsonResponse(response)) as
    | AdminProblemDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem creation is unavailable.');
  }

  return body as AdminProblemDetail;
}

export async function publishAdminProblem(
  token: string,
  problemId: string
): Promise<AdminProblemDetail> {
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}/publish`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
    | AdminProblemDetail
    | { detail?: string }
    | { error?: string; missing?: string[] }
    | null;

  if (!response.ok) {
    throw new Error(
      publishReadinessDetail(body) ?? responseDetail(body) ?? 'Admin problem publish is unavailable.'
    );
  }

  return body as AdminProblemDetail;
}

export async function updateAdminProblem(
  token: string,
  problemId: string,
  payload: AdminProblemDetail
): Promise<AdminProblemDetail> {
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseJsonResponse(response)) as
    | AdminProblemDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem update is unavailable.');
  }

  return body as AdminProblemDetail;
}
