declare module 'vscode' {
  export type Event<T> = (listener: (event: T) => unknown) => Disposable;
  export type Disposable = { dispose(): unknown };
  export class EventEmitter<T> {
    readonly event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }
  export type TreeDataProvider<T> = {
    getTreeItem(element: T): T | Thenable<T>;
    getChildren(element?: T): T[] | Thenable<T[] | readonly T[]> | readonly T[];
    onDidChangeTreeData?: Event<T | void>;
  };
  export type TextDocument = {
    getText(): string;
    languageId: string;
    fileName?: string;
  };
  export class Uri {
    readonly fsPath: string;
    static file(path: string): Uri;
  }
  export const TreeItemCollapsibleState: {
    None: 0;
  };
  export class TreeItem {
    constructor(label: string, collapsibleState?: number);
    id?: string;
    label: string;
    description?: string;
    tooltip?: string;
    command?: {
      command: string;
      title: string;
      arguments?: readonly unknown[];
    };
  }
  export type SecretStorage = {
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  export type Memento = {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: unknown): Thenable<void>;
  };
  export type ExtensionContext = {
    subscriptions: Disposable[];
    secrets: SecretStorage;
    workspaceState: Memento;
    globalState: Memento;
  };

  export const commands: {
    registerCommand(commandId: string, callback: (...args: unknown[]) => unknown): Disposable;
  };

  export const workspace: {
    getConfiguration(section?: string): {
      get<T>(setting: string, defaultValue: T): T;
    };
    workspaceFolders?: readonly {
      uri: Uri;
    }[];
    openTextDocument(options: { content: string; language?: string } | string): Thenable<TextDocument>;
  };

  export const window: {
    registerTreeDataProvider(viewId: string, provider: TreeDataProvider<TreeItem>): Disposable;
    createOutputChannel(name: string): {
      appendLine(value: string): void;
      show(preserveFocus?: boolean): void;
      dispose(): void;
    };
    activeTextEditor?: {
      document: TextDocument;
    };
    showErrorMessage(message: string): void;
    showInformationMessage(message: string): void;
    showWarningMessage<T extends string>(
      message: string,
      options: { modal: boolean },
      ...items: readonly T[]
    ): Thenable<T | undefined>;
    showTextDocument(
      document: TextDocument,
      options?: { preview?: boolean }
    ): Thenable<unknown>;
    showInputBox(options?: {
      prompt?: string;
      placeHolder?: string;
      value?: string;
      ignoreFocusOut?: boolean;
    }): Thenable<string | undefined>;
    showQuickPick<T extends { label: string }>(
      items: readonly T[],
      options?: {
        placeHolder?: string;
        ignoreFocusOut?: boolean;
      }
    ): Thenable<T | undefined>;
  };
}
