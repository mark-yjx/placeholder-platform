import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionTokenStore } from '../auth/SessionTokenStore';
import {
  AccountStatusBarActionItem,
  AccountStatusBarCommandsLike,
  AccountStatusBarController,
  AccountStatusBarItemLike,
  AccountStatusBarWindowLike
} from '../ui/AccountStatusBarController';

class FakeStatusBarItem implements AccountStatusBarItemLike {
  text = '';
  tooltip?: string;
  command?: string;
  shown = 0;

  show(): void {
    this.shown += 1;
  }

  dispose(): void {
    return;
  }
}

class FakeWindow implements AccountStatusBarWindowLike {
  constructor(private readonly pick?: AccountStatusBarActionItem) {}

  async showQuickPick<T extends { label: string }>(items: readonly T[]): Promise<T | undefined> {
    const pick = this.pick;
    if (!pick) {
      return undefined;
    }
    return items.find((item) => item.label === pick.label) as T | undefined;
  }
}

class FakeCommands implements AccountStatusBarCommandsLike {
  readonly calls: Array<{ commandId: string; args: unknown[] }> = [];

  async executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    this.calls.push({ commandId, args });
    return undefined;
  }
}

test('account status bar shows sign in when unauthenticated', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(
    item,
    new SessionTokenStore(),
    new FakeWindow(),
    new FakeCommands()
  );

  controller.refresh();

  assert.equal(item.text, '$(account) Sign in');
  assert.equal(item.tooltip, 'Sign in to OJ');
  assert.equal(item.command, 'oj.account.showActions');
  assert.equal(item.shown, 1);
});

test('account status bar shows email when authenticated with complete identity', async () => {
  const tokenStore = new SessionTokenStore();
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(
    item,
    tokenStore,
    new FakeWindow(),
    new FakeCommands()
  );

  controller.refresh();

  assert.equal(item.text, '$(account) student@example.com');
  assert.equal(item.tooltip, 'Signed in to OJ as student@example.com (student)');
});

test('account status bar treats incomplete identity as signed out', async () => {
  const tokenStore = new SessionTokenStore();
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com'
  });
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(
    item,
    tokenStore,
    new FakeWindow(),
    new FakeCommands()
  );

  controller.refresh();

  assert.equal(item.text, '$(account) Sign in');
});

test('account status bar opens login action when signed out', async () => {
  const commands = new FakeCommands();
  const controller = new AccountStatusBarController(
    new FakeStatusBarItem(),
    new SessionTokenStore(),
    new FakeWindow({ label: 'Sign in', action: 'login' }),
    commands
  );

  await controller.showActions();

  assert.deepEqual(commands.calls, [{ commandId: 'oj.login', args: [] }]);
});

test('account status bar opens logout action when signed in', async () => {
  const tokenStore = new SessionTokenStore();
  await tokenStore.setSession({
    accessToken: 'student-token',
    email: 'student@example.com',
    role: 'student'
  });
  const commands = new FakeCommands();
  const controller = new AccountStatusBarController(
    new FakeStatusBarItem(),
    tokenStore,
    new FakeWindow({ label: 'Sign out', action: 'logout' }),
    commands
  );

  await controller.showActions();

  assert.deepEqual(commands.calls, [{ commandId: 'oj.logout', args: [] }]);
});

test('account status bar opens settings action', async () => {
  const commands = new FakeCommands();
  const controller = new AccountStatusBarController(
    new FakeStatusBarItem(),
    new SessionTokenStore(),
    new FakeWindow({ label: 'OJ Settings', action: 'settings' }),
    commands
  );

  await controller.showActions();

  assert.deepEqual(commands.calls, [{ commandId: 'workbench.action.openSettings', args: ['oj'] }]);
});
