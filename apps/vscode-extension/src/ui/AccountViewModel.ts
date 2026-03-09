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
      title: 'Account',
      status: 'Sign in to OJ as a student.',
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
  const sharedHead = `    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles({ centered: true })}
    </style>`;

  if (!input.isAuthenticated) {
    return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <main class="webview-shell">
      <section class="hero-card login-card">
        <p class="eyebrow">OJ Login</p>
        <h2 class="hero-title">${title}</h2>
        <p class="hero-copy">${status}</p>
        <form class="field-stack">
          ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
          <label for="oj-account-email">
            <span>Email</span>
            <vscode-text-field id="oj-account-email" type="email"></vscode-text-field>
          </label>
          <label for="oj-account-password">
            <span>Password</span>
            <vscode-text-field id="oj-account-password" type="password"></vscode-text-field>
          </label>
          <div class="checkbox-row">
            <vscode-checkbox id="oj-account-remember-me">Remember me</vscode-checkbox>
          </div>
          <div class="login-actions">
            <vscode-button appearance="primary" data-command="login">Login</vscode-button>
          </div>
        </form>
      </section>
    </main>
    <script>
      const vscodeApi = acquireVsCodeApi();
      const emailInput = document.getElementById('oj-account-email');
      const passwordInput = document.getElementById('oj-account-password');
      const rememberMeInput = document.getElementById('oj-account-remember-me');
      const loginButton = document.querySelector('vscode-button[data-command="login"]');
      loginButton?.addEventListener('click', () => {
        vscodeApi.postMessage({
          command: 'login',
          email: emailInput?.value ?? '',
          password: passwordInput?.value ?? '',
          rememberMe: Boolean(rememberMeInput?.checked)
        });
      });
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
      <section class="hero-card login-card">
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
