import test from 'node:test';
import assert from 'node:assert/strict';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';

class FakeSecretStorage implements SecretStorageLike {
  private readonly values = new Map<string, string>();

  constructor(seed?: Record<string, string>) {
    for (const [key, value] of Object.entries(seed ?? {})) {
      this.values.set(key, value);
    }
  }

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

test('session token store persists token in SecretStorage', async () => {
  const secrets = new FakeSecretStorage();
  const store = new SessionTokenStore(secrets);

  await store.setAccessToken('student-token');

  assert.equal(store.getAccessToken(), 'student-token');

  const reloadedStore = new SessionTokenStore(secrets);
  await reloadedStore.hydrate();
  assert.equal(reloadedStore.getAccessToken(), 'student-token');
  assert.equal(reloadedStore.isAuthenticated(), true);
});

test('session token store clears persisted token from SecretStorage', async () => {
  const secrets = new FakeSecretStorage({ 'oj.auth.accessToken': 'student-token' });
  const store = new SessionTokenStore(secrets);

  await store.hydrate();
  await store.clear();

  const reloadedStore = new SessionTokenStore(secrets);
  await reloadedStore.hydrate();
  assert.equal(reloadedStore.getAccessToken(), null);
  assert.equal(reloadedStore.isAuthenticated(), false);
});
