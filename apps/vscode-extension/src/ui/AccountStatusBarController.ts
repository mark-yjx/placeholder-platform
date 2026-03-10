export type AccountStatusBarItemLike = {
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  dispose(): void;
};

export type AccountStatusBarState = {
  isAuthenticated: boolean;
  email?: string | null;
};

export class AccountStatusBarController {
  static readonly commandId = 'oj.account.show';

  constructor(private readonly item: AccountStatusBarItemLike) {
    this.item.command = AccountStatusBarController.commandId;
  }

  refresh(input?: AccountStatusBarState): void {
    const email = input?.email?.trim() ?? '';

    if (input?.isAuthenticated && email) {
      this.item.text = `$(account) ${email}`;
      this.item.tooltip = `Signed in as ${email}. Open OJ account`;
    } else {
      this.item.text = '$(account) Sign in';
      this.item.tooltip = 'Sign in to OJ';
    }

    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
