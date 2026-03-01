export const OJ_CONFIGURATION_NAMESPACE = 'oj';
export const OJ_API_BASE_URL_SETTING = 'apiBaseUrl';
export const DEFAULT_OJ_API_BASE_URL = 'http://localhost:3000';

export type WorkspaceConfigurationLike = {
  get<T>(section: string, defaultValue: T): T;
};

export function resolveApiBaseUrl(configuration: WorkspaceConfigurationLike): string {
  const configured = configuration.get<string>(OJ_API_BASE_URL_SETTING, DEFAULT_OJ_API_BASE_URL).trim();
  const normalized = configured.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : DEFAULT_OJ_API_BASE_URL;
}
