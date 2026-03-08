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

test('account status bar shows icon-only login entry point', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(item);

  controller.refresh();

  assert.equal(item.text, '$(account)');
  assert.equal(item.tooltip, 'Open OJ account');
  assert.equal(item.command, 'oj.account.show');
  assert.equal(item.shown, 1);
});

test('account status bar remains icon-only after repeated refreshes', () => {
  const item = new FakeStatusBarItem();
  const controller = new AccountStatusBarController(item);

  controller.refresh();
  controller.refresh();

  assert.equal(item.text, '$(account)');
  assert.equal(item.shown, 2);
});
