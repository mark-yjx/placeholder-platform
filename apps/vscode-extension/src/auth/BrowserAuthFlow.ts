import { randomUUID } from 'node:crypto';
import { AuthCommands } from './AuthCommands';
import { BrowserAuthMode } from './AuthClient';
import { mapExtensionError } from '../errors/ExtensionErrorMapper';

const PENDING_BROWSER_AUTH_KEY = 'oj.auth.pendingBrowserAuth';
const PENDING_BROWSER_AUTH_TTL_MS = 10 * 60 * 1000;
const STUDENT_AUTH_CALLBACK_PATH = '/auth-complete';
const STUDENT_AUTH_EXTENSION_AUTHORITY = 'placeholder.placeholder-extension';

type PendingBrowserAuth = {
  mode: BrowserAuthMode;
  state: string;
  callbackUri: string;
  createdAt: number;
};

export type BrowserAuthWindowLike = {
  showErrorMessage: (message: string) => void;
  showInformationMessage: (message: string) => void;
  showInputBox: (options?: {
    prompt?: string;
    placeHolder?: string;
    value?: string;
    password?: boolean;
    ignoreFocusOut?: boolean;
  }) => PromiseLike<string | undefined>;
};

export type BrowserAuthOutputLike = {
  appendLine: (value: string) => void;
};

export type BrowserAuthStateStoreLike = {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
};

export type BrowserAuthUriLike = {
  path?: string;
  query?: string;
  toString(): string;
};

export interface BrowserAuthFlowLike {
  start(mode: BrowserAuthMode): Promise<void>;
  enterFallbackCode(): Promise<boolean>;
  handleUri(uri: BrowserAuthUriLike): Promise<void>;
}

export class BrowserAuthFlow implements BrowserAuthFlowLike {
  private pendingAuth: PendingBrowserAuth | null = null;

  constructor(
    private readonly authCommands: AuthCommands,
    private readonly window: BrowserAuthWindowLike,
    private readonly openExternalUrl: (url: string) => PromiseLike<void>,
    private readonly callbackUriFactory: () => string,
    private readonly options: {
      output?: BrowserAuthOutputLike;
      stateStore?: BrowserAuthStateStoreLike;
      onSessionChanged?: () => void;
      now?: () => number;
    } = {}
  ) {}

  async start(mode: BrowserAuthMode): Promise<void> {
    const pending: PendingBrowserAuth = {
      mode,
      state: randomUUID(),
      callbackUri: this.callbackUriFactory(),
      createdAt: this.now()
    };
    await this.writePendingAuth(pending);

    try {
      const browserUrl = this.authCommands.getBrowserAuthUrl(mode, {
        callbackUri: pending.callbackUri,
        state: pending.state
      });
      await this.openExternalUrl(browserUrl);
      this.options.output?.appendLine(`Browser auth started via ${mode}.`);
      this.window.showInformationMessage(
        mode === 'sign-in'
          ? 'Student sign-in opened in your browser. Finish there and VS Code will complete sign-in automatically. If the callback does not return, use the fallback code shown in the browser from the Placeholder Practice window.'
          : 'Student sign-up opened in your browser. Finish there and VS Code will complete sign-in automatically. If the callback does not return, use the fallback code shown in the browser from the Placeholder Practice window.'
      );
    } catch (error) {
      await this.clearPendingAuth();
      throw error;
    }
  }

  async enterFallbackCode(): Promise<boolean> {
    const code = await this.window.showInputBox({
      prompt: 'Paste the one-time browser auth code shown in your browser',
      placeHolder: 'Example: 8F2A9C4D10',
      ignoreFocusOut: true
    });
    if (code === undefined) {
      return false;
    }

    await this.completeBrowserAuthCode(code, 'manual fallback');
    return true;
  }

  async handleUri(uri: BrowserAuthUriLike): Promise<void> {
    if (!this.isStudentAuthCallback(uri)) {
      return;
    }

    const pending = this.readPendingAuth();
    if (!pending) {
      this.window.showErrorMessage(
        'Received a browser auth callback, but no student sign-in is pending. Start again from Placeholder Practice Login or Sign up.'
      );
      return;
    }

    if (pending.createdAt + PENDING_BROWSER_AUTH_TTL_MS < this.now()) {
      await this.clearPendingAuth();
      this.window.showErrorMessage(
        'The pending browser auth callback has expired. Start again from Placeholder Practice Login or Sign up.'
      );
      return;
    }

    const params = new URLSearchParams(uri.query ?? '');
    const state = String(params.get('state') ?? '').trim();
    const code = String(params.get('code') ?? '').trim();

    if (!state) {
      this.window.showErrorMessage(
        'The browser auth callback is missing its state value. If the browser shows a code, use the fallback code entry from the Placeholder Practice window.'
      );
      return;
    }

    if (state !== pending.state) {
      this.window.showErrorMessage(
        'The browser auth callback was rejected because the state did not match. Start again or use the fallback code shown in the browser.'
      );
      return;
    }

    if (!code) {
      this.window.showErrorMessage(
        'The browser auth callback did not include a sign-in code. If the browser shows a code, use the fallback code entry from the Placeholder Practice window.'
      );
      return;
    }

    try {
      await this.completeBrowserAuthCode(code, 'callback');
    } catch (error) {
      const message = this.resolveBrowserAuthErrorMessage(error);
      this.options.output?.appendLine(`Browser auth callback failed: ${message}`);
      this.options.onSessionChanged?.();
      this.window.showErrorMessage(message);
    }
  }

  private async completeBrowserAuthCode(
    code: string,
    source: 'callback' | 'manual fallback'
  ): Promise<void> {
    const session = await this.authCommands.completeBrowserAuth(code);
    const email = session.email?.trim() ?? '';
    const role = session.role?.trim() ?? '';
    if (!email || !role) {
      await this.authCommands.logout();
      throw new Error('Login succeeded but account details are incomplete.');
    }

    await this.clearPendingAuth();
    this.options.output?.appendLine(`Browser auth completed via ${source}.`);
    this.options.onSessionChanged?.();
    this.window.showInformationMessage(`Logged in as ${email} (${role}).`);
  }

  private resolveBrowserAuthErrorMessage(error: unknown): string {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage === 'Login succeeded but account details are incomplete.') {
      return 'Login failed because the account profile is incomplete. Try again or contact your instructor.';
    }

    return mapExtensionError(error).userMessage.replace(
      'Run Placeholder Practice: Sign In and try again.',
      'Open Placeholder Practice and try again.'
    );
  }

  private isStudentAuthCallback(uri: BrowserAuthUriLike): boolean {
    const path = (uri.path ?? '').trim();
    return path === STUDENT_AUTH_CALLBACK_PATH || path === STUDENT_AUTH_CALLBACK_PATH.slice(1);
  }

  private readPendingAuth(): PendingBrowserAuth | null {
    if (this.pendingAuth) {
      return this.pendingAuth;
    }
    if (!this.options.stateStore) {
      return null;
    }

    const stored = this.options.stateStore.get<PendingBrowserAuth | null>(PENDING_BROWSER_AUTH_KEY, null);
    if (!stored) {
      return null;
    }

    if (
      typeof stored.mode !== 'string' ||
      typeof stored.state !== 'string' ||
      typeof stored.callbackUri !== 'string' ||
      typeof stored.createdAt !== 'number'
    ) {
      return null;
    }

    return stored;
  }

  private async writePendingAuth(pending: PendingBrowserAuth): Promise<void> {
    this.pendingAuth = pending;
    if (!this.options.stateStore) {
      return;
    }
    await this.options.stateStore.update(PENDING_BROWSER_AUTH_KEY, pending);
  }

  private async clearPendingAuth(): Promise<void> {
    this.pendingAuth = null;
    if (!this.options.stateStore) {
      return;
    }
    await this.options.stateStore.update(PENDING_BROWSER_AUTH_KEY, undefined);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

export function createStudentAuthCallbackUri(uriScheme: string): string {
  return `${uriScheme}://${STUDENT_AUTH_EXTENSION_AUTHORITY}${STUDENT_AUTH_CALLBACK_PATH}`;
}
