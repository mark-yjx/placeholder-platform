const DEFAULT_ADMIN_API_BASE_URL = 'http://127.0.0.1:8200';
const DEFAULT_ADMIN_API_TIMEOUT_MS = 8000;

type LocationLike = Pick<Location, 'hostname' | 'protocol'>;

function trimConfiguredBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.replace(/\/$/, '') : null;
}

export function resolveAdminApiBaseUrl(
  currentLocation: LocationLike | null = typeof window === 'undefined' ? null : window.location
): string {
  const configuredBaseUrl = trimConfiguredBaseUrl(import.meta.env.VITE_ADMIN_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!currentLocation) {
    return DEFAULT_ADMIN_API_BASE_URL;
  }

  if (currentLocation.hostname === 'localhost' || currentLocation.hostname === '127.0.0.1') {
    return DEFAULT_ADMIN_API_BASE_URL;
  }

  const forwardedHostname = deriveForwardedAdminApiHostname(currentLocation.hostname);
  if (forwardedHostname) {
    return `${currentLocation.protocol}//${forwardedHostname}`;
  }

  return `${currentLocation.protocol}//${currentLocation.hostname}:8200`;
}

function deriveForwardedAdminApiHostname(hostname: string): string | null {
  const labels = hostname.split('.');
  const firstLabel = labels[0] ?? '';
  const prefixedLabel = firstLabel.replace(/^\d+-/, '8200-');
  if (prefixedLabel !== firstLabel) {
    labels[0] = prefixedLabel;
    return labels.join('.');
  }

  const suffixedLabel = firstLabel.replace(/-\d+$/, '-8200');
  if (suffixedLabel !== firstLabel) {
    labels[0] = suffixedLabel;
    return labels.join('.');
  }

  return null;
}

export function resolveAdminApiTimeoutMs(rawTimeout = import.meta.env.VITE_ADMIN_API_TIMEOUT_MS): number {
  const parsed = Number(rawTimeout);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ADMIN_API_TIMEOUT_MS;
}

export async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

export function responseDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return null;
  }

  const detail = body.detail;
  if (typeof detail === 'string') {
    return detail;
  }

  if (!Array.isArray(detail)) {
    return null;
  }

  const messages = detail
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (typeof item !== 'object' || item === null) {
        return '';
      }

      const rawMessage = 'msg' in item && typeof item.msg === 'string' ? item.msg.trim() : '';
      if (!rawMessage) {
        return '';
      }

      const normalizedMessage = rawMessage.replace(/^Value error,\s*/i, '');
      const location =
        'loc' in item && Array.isArray(item.loc)
          ? item.loc
              .filter((part: unknown): part is string => typeof part === 'string' && part !== 'body')
              .join('.')
          : '';
      return location ? `${location}: ${normalizedMessage}` : normalizedMessage;
    })
    .filter((message) => message.length > 0);

  return messages.length > 0 ? messages.join(' ') : null;
}

export async function fetchAdminApi(path: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = resolveAdminApiTimeoutMs();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${resolveAdminApiBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError'
    ) {
      throw new Error(
        `Admin API request timed out after ${timeoutMs}ms. Verify the Admin API server and VITE_ADMIN_API_BASE_URL.`
      );
    }

    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }

    throw new Error(
      `Unable to reach Admin API at ${resolveAdminApiBaseUrl()}. Verify the Admin API server and VITE_ADMIN_API_BASE_URL.`
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
