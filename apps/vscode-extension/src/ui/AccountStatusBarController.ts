export type AccountStatusBarItemLike = {
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  dispose(): void;
};

export class AccountStatusBarController {
  static readonly commandId = 'oj.account.show';

  constructor(private readonly item: AccountStatusBarItemLike) {
    this.item.command = AccountStatusBarController.commandId;
  }

  refresh(): void {
    this.item.text = '$(account)';
    this.item.tooltip = 'Open OJ account';
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
