import { SessionTokenStore } from '../auth/SessionTokenStore';

export function assertAuthenticated(tokenStore: SessionTokenStore): void {
  if (!tokenStore.isAuthenticated()) {
    throw new Error('Authentication required');
  }
}

export async function runProtectedCommand<T>(
  tokenStore: SessionTokenStore,
  execute: () => Promise<T>
): Promise<T> {
  assertAuthenticated(tokenStore);
  return execute();
}
