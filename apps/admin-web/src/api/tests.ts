import { fetchAdminApi, parseJsonResponse, responseDetail } from './client';

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

export async function fetchAdminProblemTests(
  token: string,
  problemId: string
): Promise<AdminProblemTestsDetail> {
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}/tests`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseJsonResponse(response)) as
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
  const response = await fetchAdminApi(`/admin/problems/${encodeURIComponent(problemId)}/tests`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = (await parseJsonResponse(response)) as
    | AdminProblemTestsDetail
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin problem tests update is unavailable.');
  }

  return body as AdminProblemTestsDetail;
}
