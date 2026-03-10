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
  private static readonly visibleText = '$(account) OJ';

  constructor(private readonly item: AccountStatusBarItemLike) {
    this.item.command = AccountStatusBarController.commandId;
  }

  refresh(input?: AccountStatusBarState): void {
    const email = input?.email?.trim() ?? '';
    this.item.text = AccountStatusBarController.visibleText;

    if (input?.isAuthenticated && email) {
      this.item.tooltip = `Signed in as ${email}. Open OJ account and stats`;
    } else {
      this.item.tooltip = 'Open OJ account and sign in to start practicing';
    }

    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
