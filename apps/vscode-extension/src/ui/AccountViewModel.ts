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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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
      body {
        font-family: var(--vscode-font-family);
        padding: 0 8px 12px;
      }

      form,
      .account-panel {
        display: grid;
        gap: 12px;
      }

      .account-actions {
        display: flex;
        gap: 8px;
      }

      p {
        margin: 0;
      }

      code {
        font-family: var(--vscode-editor-font-family, monospace);
      }
    </style>`;

  if (!input.isAuthenticated) {
    return `<!doctype html>
<html lang="en">
  <head>
${sharedHead}
  </head>
  <body>
    <section class="account-panel">
      <h2>${title}</h2>
      <p>${status}</p>
      ${errorMessage}
      <form>
        <label for="oj-account-email">Email</label>
        <vscode-text-field id="oj-account-email" type="email"></vscode-text-field>
        <label for="oj-account-password">Password</label>
        <vscode-text-field id="oj-account-password" type="password"></vscode-text-field>
        <div class="account-actions">
          <vscode-button appearance="primary" data-command="login">Login</vscode-button>
        </div>
      </form>
    </section>
    <script>
      const vscodeApi = acquireVsCodeApi();
      const emailInput = document.getElementById('oj-account-email');
      const passwordInput = document.getElementById('oj-account-password');
      const loginButton = document.querySelector('vscode-button[data-command="login"]');
      loginButton?.addEventListener('click', () => {
        vscodeApi.postMessage({
          command: 'login',
          email: emailInput?.value ?? '',
          password: passwordInput?.value ?? ''
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
    <section class="account-panel">
      <h2>${title}</h2>
      <p>${status}</p>
      ${errorMessage}
      <p>Logged in as <strong>${email}</strong></p>
      <p>Role: <code>${role}</code></p>
      <div class="account-actions">
        <vscode-button data-command="logout">Logout</vscode-button>
      </div>
    </section>
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
