export type AdminAnalyticsOverview = {
  totalUsers: number;
  activeUsers: number;
  activeWindowDays: number;
  totalSubmissions: number;
  totalAcceptedSubmissions: number;
  uniqueProblemSolves: number;
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

export async function fetchAdminAnalyticsOverview(token: string): Promise<AdminAnalyticsOverview> {
  const response = await fetch(`${adminApiBaseUrl()}/admin/analytics/overview`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await parseResponse(response)) as AdminAnalyticsOverview | { detail?: string } | null;

  if (!response.ok) {
    throw new Error(responseDetail(body) ?? 'Admin analytics overview is unavailable.');
  }

  return body as AdminAnalyticsOverview;
}
