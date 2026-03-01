declare module 'vscode' {
  export type Disposable = { dispose(): unknown };
  export type SecretStorage = {
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  export type ExtensionContext = {
    subscriptions: Disposable[];
    secrets: SecretStorage;
  };

  export const commands: {
    registerCommand(commandId: string, callback: () => Promise<void>): Disposable;
  };

  export const workspace: {
    getConfiguration(section?: string): {
      get<T>(setting: string, defaultValue: T): T;
    };
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
