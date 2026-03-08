import { SessionTokenStore } from '../auth/SessionTokenStore';

export type AccountStatusBarActionItem = {
  label: string;
  description?: string;
  action: 'login' | 'logout' | 'settings';
};

export type AccountStatusBarItemLike = {
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  dispose(): void;
};

export type AccountStatusBarWindowLike = {
  showQuickPick: <T extends { label: string }>(
    items: readonly T[],
    options?: {
      placeHolder?: string;
      ignoreFocusOut?: boolean;
    }
  ) => Promise<T | undefined>;
};

export type AccountStatusBarCommandsLike = {
  executeCommand: (commandId: string, ...args: unknown[]) => Promise<unknown>;
};

export class AccountStatusBarController {
  static readonly commandId = 'oj.account.showActions';

  constructor(
    private readonly item: AccountStatusBarItemLike,
    private readonly tokenStore: SessionTokenStore,
    private readonly window: AccountStatusBarWindowLike,
    private readonly commands: AccountStatusBarCommandsLike
  ) {
    this.item.command = AccountStatusBarController.commandId;
  }

  refresh(): void {
    const identity = this.tokenStore.getSessionIdentity();
    const email = identity.email?.trim() || null;
    const role = identity.role?.trim() || null;
    const isAuthenticated = this.tokenStore.isAuthenticated() && email !== null && role !== null;

    if (isAuthenticated) {
      this.item.text = `$(account) ${email}`;
      this.item.tooltip = `Signed in to OJ as ${email} (${role})`;
    } else {
      this.item.text = '$(account) Sign in';
      this.item.tooltip = 'Sign in to OJ';
    }

    this.item.show();
  }

  async showActions(): Promise<void> {
    const identity = this.tokenStore.getSessionIdentity();
    const email = identity.email?.trim() || null;
    const role = identity.role?.trim() || null;
    const isAuthenticated = this.tokenStore.isAuthenticated() && email !== null && role !== null;

    const items: readonly AccountStatusBarActionItem[] = isAuthenticated
      ? [
          {
            label: 'Sign out',
            description: `${email} (${role})`,
            action: 'logout'
          },
          {
            label: 'OJ Settings',
            description: 'Configure API and extension settings',
            action: 'settings'
          }
        ]
      : [
          {
            label: 'Sign in',
            description: 'Authenticate with the OJ API',
            action: 'login'
          },
          {
            label: 'OJ Settings',
            description: 'Configure API and extension settings',
            action: 'settings'
          }
        ];

    const picked = await this.window.showQuickPick(items, {
      placeHolder: 'Choose an OJ account action',
      ignoreFocusOut: true
    });

    if (!picked) {
      return;
    }

    if (picked.action === 'settings') {
      await this.commands.executeCommand('workbench.action.openSettings', 'oj');
      return;
    }

    await this.commands.executeCommand(picked.action === 'login' ? 'oj.login' : 'oj.logout');
  }

  dispose(): void {
    this.item.dispose();
  }
}
