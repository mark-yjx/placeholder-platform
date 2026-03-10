import { createWebviewStyles, escapeHtml } from './WebviewTheme';

export type AccountViewModel = {
  title: string;
  status: string;
  email: string;
  role: string;
  errorMessage: string;
  isAuthenticated: boolean;
};

function normalizeIdentityField(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function createAccountViewModel(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  errorMessage?: string | null;
}): AccountViewModel {
  const email = normalizeIdentityField(input.email);
  const role = normalizeIdentityField(input.role);

  if (!input.isAuthenticated || !email || !role) {
    return {
      title: 'OJ Practice',
      status: 'Solve problems directly in VS Code.',
      email: '',
      role: '',
      errorMessage: input.errorMessage ?? '',
      isAuthenticated: false
    };
  }

  return {
    title: 'Account',
    status: 'You are signed in to OJ as a student.',
    email,
    role,
    errorMessage: input.errorMessage ?? '',
    isAuthenticated: true
  };
}

export function createAccountHtml(input: AccountViewModel): string {
  const title = escapeHtml(input.title);
  const status = escapeHtml(input.status);
  const email = escapeHtml(input.email);
  const role = escapeHtml(input.role);
  const errorMessage = input.errorMessage ? `<p role="alert">${escapeHtml(input.errorMessage)}</p>` : '';
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';
  const accountStyles = `
      .account-shell {
        width: min(100%, 580px);
        gap: 20px;
      }

      .account-shell .account-intro {
        display: grid;
        gap: 10px;
        justify-items: center;
        text-align: center;
      }

      .account-shell .account-intro .hero-title {
        margin-top: 0;
      }

      .account-shell .auth-required-card {
        display: grid;
        gap: 18px;
        padding: 28px 24px;
      }

      .account-shell .account-card-copy {
        margin: 0;
        color: var(--text-primary);
        font-size: 1rem;
        line-height: 1.6;
      }

      .account-shell .account-actions {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .account-shell .account-actions vscode-button::part(control),
      .account-shell .account-fallback vscode-button::part(control) {
        justify-content: center;
        min-height: 42px;
      }

      .account-shell .account-helper {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
        max-width: 34ch;
      }

      .account-shell .account-fallback {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        padding-top: 2px;
      }

      .account-shell .account-fallback-copy {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .account-shell .account-fallback vscode-button {
        width: fit-content;
      }

      .account-shell .alert-card {
        width: 100%;
      }

      .account-shell .account-signed-in {
        gap: 14px;
      }
    `;
  const sharedHead = `    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles({ centered: true })}
      ${accountStyles}
    </style>`;

  if (!input.isAuthenticated) {
    return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell account-shell">
      <div class="account-intro">
        <h2 class="hero-title">${title}</h2>
        <p class="hero-copy">${status}</p>
      </div>
      ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
      <section class="hero-card auth-required-card">
        <p class="account-card-copy">Sign in to sync your account, fetch problems, and submit.</p>
        <div class="account-actions">
          <vscode-button appearance="primary" data-command="signIn">Sign in</vscode-button>
          <vscode-button appearance="secondary" data-command="signUp">Sign up</vscode-button>
        </div>
        <p class="account-helper">Auth opens in your browser and returns automatically.</p>
        <div class="account-fallback">
          <p class="account-fallback-copy">Already have a browser code?</p>
          <vscode-button appearance="secondary" data-command="enterCode">Enter code</vscode-button>
        </div>
      </section>
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('vscode-button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell">
      <section class="hero-card login-card account-signed-in">
        <p class="eyebrow">OJ Account</p>
        <h2 class="hero-title">${title}</h2>
        <p class="hero-copy">${status}</p>
        ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
        <div class="inline-meta">
          <p>Logged in as <strong>${email}</strong></p>
          <p>Role: <code>${role}</code></p>
        </div>
        <div class="login-actions">
          <vscode-button data-command="logout">Logout</vscode-button>
        </div>
      </section>
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('vscode-button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}
