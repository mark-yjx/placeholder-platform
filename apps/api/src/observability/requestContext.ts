import { randomUUID } from 'node:crypto';

export type ApiRequestContext = {
  requestId: string;
};

export function createApiRequestContext(
  headers: Readonly<Record<string, string | undefined>>,
  generateId: () => string = randomUUID
): ApiRequestContext {
  const incoming = headers['x-request-id']?.trim();
  return {
    requestId: incoming && incoming.length > 0 ? incoming : generateId()
  };
}
