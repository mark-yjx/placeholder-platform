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
      status: 'Sign in to sync your account, fetch problems, and submit solutions.',
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
      }

      .account-shell .hero-card {
        overflow: hidden;
      }

      .account-shell .login-card {
        gap: 20px;
      }

      .account-shell .account-intro {
        display: grid;
        gap: 10px;
        max-width: 42ch;
      }

      .account-shell .account-section {
        display: grid;
        gap: 12px;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background:
          linear-gradient(180deg, color-mix(in srgb, var(--surface) 84%, transparent), transparent 160%),
          color-mix(in srgb, var(--surface-muted) 72%, var(--surface));
      }

      .account-shell .account-section-title {
        margin: 0;
        font-size: 0.84rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-secondary);
      }

      .account-shell .account-section-copy {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .account-shell .account-actions {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .account-shell .account-actions vscode-button::part(control),
      .account-shell .account-secondary-actions vscode-button::part(control) {
        justify-content: center;
        min-height: 42px;
      }

      .account-shell .account-secondary-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .account-shell .auth-helper {
        display: grid;
        gap: 12px;
      }

      .account-shell .auth-helper-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .account-shell .auth-helper-actions vscode-button {
        width: fit-content;
      }

      .account-shell .auth-helper-note {
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .account-shell .account-note {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px dashed var(--border);
        background: color-mix(in srgb, var(--surface) 78%, transparent);
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .account-shell .account-note strong {
        color: var(--vscode-foreground);
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
      <section class="hero-card login-card">
        <div class="account-intro">
          <p class="eyebrow">Student Practice</p>
          <h2 class="hero-title">${title}</h2>
          <p class="hero-copy">${status}</p>
        </div>
        ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
        <section class="account-section">
          <p class="account-section-title">Get Started</p>
          <p class="account-section-copy">Authentication opens in your browser and returns to VS Code automatically.</p>
          <div class="account-actions">
            <vscode-button appearance="primary" data-command="signIn">Sign in</vscode-button>
            <vscode-button data-command="signUp">Sign up</vscode-button>
          </div>
        </section>
        <section class="account-section">
          <p class="account-section-title">Need A Fallback?</p>
          <div class="auth-helper">
            <p class="account-section-copy">If VS Code does not reopen after browser auth, you can still finish with the one-time code shown in the browser.</p>
            <div class="auth-helper-actions">
              <vscode-button data-command="enterCode">Enter browser code</vscode-button>
            </div>
          </div>
        </section>
        <p class="account-note"><strong>Note:</strong> Sign in and Sign up always happen in your browser. VS Code is just where you continue practicing once your student session is ready.</p>
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
