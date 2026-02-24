declare module 'vscode' {
  export type Disposable = { dispose(): unknown };
  export type ExtensionContext = { subscriptions: Disposable[] };

  export const commands: {
    registerCommand(commandId: string, callback: () => Promise<void>): Disposable;
  };

  export const window: {
    createOutputChannel(name: string): {
      appendLine(value: string): void;
      show(preserveFocus?: boolean): void;
      dispose(): void;
    };
    showErrorMessage(message: string): void;
    showInformationMessage(message: string): void;
  };
}
