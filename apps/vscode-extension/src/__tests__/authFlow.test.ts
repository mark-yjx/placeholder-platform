import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthClient } from '../auth/AuthClient';
import { AuthCommands } from '../auth/AuthCommands';
import { createLoginViewModel } from '../auth/AuthViews';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import { runProtectedCommand } from '../commands/ProtectedCommands';

class FakeAuthClient implements AuthClient {
  async login(): Promise<{ accessToken: string }> {
    return { accessToken: 'student-token' };
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
  const commands = new AuthCommands(new FakeAuthClient(), tokenStore);

  await commands.login({ email: 'student@example.com', password: 'secret' });

  const result = await runProtectedCommand(tokenStore, async () => 'ok');
  assert.equal(result, 'ok');
  assert.equal(tokenStore.getAccessToken(), 'student-token');
});

test('login view model exposes auth fields', () => {
  const view = createLoginViewModel();
  assert.equal(view.title, 'Student Login');
  assert.deepEqual(view.fields, ['email', 'password']);
});
