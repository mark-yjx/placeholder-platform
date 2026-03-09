import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands, STUDENT_ONLY_EXTENSION_MESSAGE } from '../auth/AuthCommands';
import { createLoginViewModel } from '../auth/AuthViews';
import { SecretStorageLike, SessionTokenStore } from '../auth/SessionTokenStore';
import { runProtectedCommand } from '../commands/ProtectedCommands';

class FakeAuthClient implements AuthClient {
  constructor(
    private readonly response: { accessToken: string; role?: 'admin' | 'student' } = {
      accessToken: 'student-token',
      role: 'student'
    }
  ) {}

  async login(): Promise<{ accessToken: string; role?: 'admin' | 'student' }> {
    return this.response;
  }
}

class FakeSecretStorage implements SecretStorageLike {
  private readonly values = new Map<string, string>();

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

test('unauthenticated student cannot run protected command', async () => {
  const tokenStore = new SessionTokenStore();

  await assert.rejects(
    runProtectedCommand(tokenStore, async () => 'ok'),
    /Authentication required/
  );
});

test('authenticated student can run protected command after login', async () => {
  const tokenStore = new SessionTokenStore();
  const commands = new AuthCommands(new FakeAuthClient({ accessToken: 'student-token', role: 'student' }), tokenStore);

  await commands.login({ email: 'student@example.com', password: 'secret' });

  const result = await runProtectedCommand(tokenStore, async () => 'ok');
  assert.equal(result, 'ok');
  assert.equal(tokenStore.getAccessToken(), 'student-token');
});

test('admin login is rejected and clears any existing extension session', async () => {
  const secrets = new FakeSecretStorage();
  const tokenStore = new SessionTokenStore(secrets);
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const commands = new AuthCommands(new FakeAuthClient({ accessToken: 'admin-token', role: 'admin' }), tokenStore);

  await assert.rejects(
    commands.login({ email: 'admin@example.com', password: 'secret' }),
    new RegExp(STUDENT_ONLY_EXTENSION_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );

  assert.equal(tokenStore.isAuthenticated(), false);
  assert.equal(tokenStore.getAccessToken(), null);
  assert.deepEqual(tokenStore.getSessionIdentity(), {
    email: null,
    role: null
  });

  const restoredStore = new SessionTokenStore(secrets);
  await restoredStore.hydrate();
  assert.equal(restoredStore.isAuthenticated(), false);
  assert.deepEqual(restoredStore.getSessionIdentity(), {
    email: null,
    role: null
  });
});

test('login view model exposes auth fields', () => {
  const view = createLoginViewModel();
  assert.equal(view.title, 'OJ Login');
  assert.deepEqual(view.fields, ['email', 'password']);
});
