import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountStatusBarController, AccountStatusBarItemLike } from '../ui/AccountStatusBarController';

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

test('account status bar shows a visible sign-in entry point before login', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(item);

  controller.refresh();

  assert.equal(item.text, '$(account) OJ');
  assert.equal(item.tooltip, 'Open OJ account and sign in to start practicing');
  assert.equal(item.command, 'oj.account.show');
  assert.equal(item.shown, 1);
});

test('account status bar shows the student email after login', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(item);

  controller.refresh({ isAuthenticated: true, email: 'student1@example.com' });

  assert.equal(item.text, '$(account) OJ');
  assert.equal(item.tooltip, 'Signed in as student1@example.com. Open OJ account and stats');
  assert.equal(item.shown, 1);
});

test('account status bar remains stable after repeated refreshes', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(item);

  controller.refresh();
  controller.refresh({ isAuthenticated: true, email: 'student1@example.com' });

  assert.equal(item.text, '$(account) OJ');
  assert.equal(item.shown, 2);
});
