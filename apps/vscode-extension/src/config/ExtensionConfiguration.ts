export const OJ_CONFIGURATION_NAMESPACE = 'oj';
export const OJ_API_BASE_URL_SETTING = 'apiBaseUrl';
export const OJ_REQUEST_TIMEOUT_MS_SETTING = 'requestTimeoutMs';
export const DEFAULT_OJ_API_BASE_URL = 'http://127.0.0.1:3100';
export const DEFAULT_OJ_REQUEST_TIMEOUT_MS = 10_000;

export type WorkspaceConfigurationLike = {
  get<T>(section: string, defaultValue: T): T;
};

export function resolveApiBaseUrl(configuration: WorkspaceConfigurationLike): string {
  const configured = configuration.get<string>(OJ_API_BASE_URL_SETTING, DEFAULT_OJ_API_BASE_URL).trim();
  const normalized = configured.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : DEFAULT_OJ_API_BASE_URL;
}

export function resolveRequestTimeoutMs(configuration: WorkspaceConfigurationLike): number {
  const configured = configuration.get<number>(
    OJ_REQUEST_TIMEOUT_MS_SETTING,
    DEFAULT_OJ_REQUEST_TIMEOUT_MS
  );

  if (!Number.isFinite(configured) || configured <= 0) {
    throw new Error(
      `Invalid oj.requestTimeoutMs: ${configured}. Set oj.requestTimeoutMs to a positive number of milliseconds.`
    );
  }

  return Math.trunc(configured);
}

export function validateApiBaseUrl(apiBaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error(
      `Invalid oj.apiBaseUrl: ${apiBaseUrl}. Set oj.apiBaseUrl to a valid http:// or https:// URL.`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid oj.apiBaseUrl: ${apiBaseUrl}. Set oj.apiBaseUrl to a valid http:// or https:// URL.`
    );
  }

  return apiBaseUrl;
}

export function describeTokenStorageBehavior(): string {
  return 'Auth tokens are stored in VS Code SecretStorage on this machine.';
}
