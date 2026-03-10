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
      status: 'Student authentication now happens in your browser.',
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
        width: min(100%, 560px);
      }

      .account-shell .login-card {
        gap: 18px;
      }

      .account-shell .hero-copy {
        max-width: 44ch;
      }

      .account-shell .account-intro {
        display: grid;
        gap: 8px;
      }

      .account-shell .account-hero {
        display: grid;
        gap: 14px;
      }

      .account-shell .account-section {
        display: grid;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background:
          linear-gradient(180deg, color-mix(in srgb, var(--surface-muted) 70%, transparent), transparent 150%),
          var(--surface-muted);
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
      }

      .account-shell .account-actions {
        display: grid;
        gap: 10px;
      }

      .account-shell .account-actions vscode-button,
      .account-shell .account-secondary-actions vscode-button {
        width: 100%;
      }

      .account-shell .account-actions vscode-button::part(control),
      .account-shell .account-secondary-actions vscode-button::part(control) {
        justify-content: center;
        min-height: 38px;
      }

      .account-shell .account-secondary-actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .account-shell .account-steps {
        display: grid;
        gap: 10px;
      }

      .account-shell .account-step {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }

      .account-shell .account-step-number {
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-secondary);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .account-shell .account-step-copy {
        display: grid;
        gap: 4px;
      }

      .account-shell .account-step-copy strong {
        font-size: 0.95rem;
      }

      .account-shell .account-note {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px dashed var(--border);
        background: color-mix(in srgb, var(--surface) 72%, transparent);
        color: var(--text-secondary);
      }

      .account-shell .account-note strong {
        color: var(--vscode-foreground);
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
        <div class="account-hero">
          <div class="account-intro">
            <p class="eyebrow">Student Auth</p>
            <h2 class="hero-title">${title}</h2>
            <p class="hero-copy">${status}</p>
          </div>
          <p class="hero-copy">Continue in your system browser and let VS Code finish automatically when the browser redirects back.</p>
        </div>
        ${errorMessage ? `<div class="alert-card error-text">${errorMessage}</div>` : ''}
        <section class="account-section">
          <p class="account-section-title">Primary action</p>
          <p class="account-section-copy">Already have an account? Open the browser sign-in flow and VS Code will complete the student session automatically after browser auth succeeds.</p>
          <div class="account-actions">
            <vscode-button appearance="primary" data-command="signIn">Sign in</vscode-button>
          </div>
        </section>
        <section class="account-section">
          <p class="account-section-title">New to OJ?</p>
          <p class="account-section-copy">Create your student account in the browser, then let the browser hand control back to VS Code automatically.</p>
          <div class="account-secondary-actions">
            <vscode-button data-command="signUp">Sign up</vscode-button>
          </div>
        </section>
        <section class="account-section">
          <p class="account-section-title">How it works</p>
          <div class="account-steps">
            <div class="account-step">
              <span class="account-step-number">1</span>
              <div class="account-step-copy">
                <strong>Open browser auth</strong>
                <p class="account-section-copy">Choose Sign in or Sign up to launch the student auth page in your browser.</p>
              </div>
            </div>
            <div class="account-step">
              <span class="account-step-number">2</span>
              <div class="account-step-copy">
                <strong>Finish in the browser</strong>
                <p class="account-section-copy">Complete the login or registration flow there. The student auth page will immediately try to reopen VS Code when it succeeds.</p>
              </div>
            </div>
            <div class="account-step">
              <span class="account-step-number">3</span>
              <div class="account-step-copy">
                <strong>Automatic completion</strong>
                <p class="account-section-copy">VS Code validates the callback state, exchanges the one-time code, and refreshes your signed-in student session automatically.</p>
              </div>
            </div>
          </div>
        </section>
        <section class="account-section">
          <p class="account-section-title">Fallback</p>
          <p class="account-section-copy">If your browser cannot reopen VS Code, use the one-time code shown in the browser success page here instead.</p>
          <div class="account-secondary-actions">
            <vscode-button data-command="enterCode">Enter browser code</vscode-button>
          </div>
        </section>
        <p class="account-note"><strong>Note:</strong> manual code entry is fallback-only. The normal path is browser auth redirecting back into VS Code automatically.</p>
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
