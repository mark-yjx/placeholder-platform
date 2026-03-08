export type AccountViewModel = {
  title: string;
  status: string;
  email: string;
  role: string;
  errorMessage: string;
  isAuthenticated: boolean;
};

export function createAccountViewModel(input: {
  isAuthenticated: boolean;
  email?: string | null;
  role?: string | null;
  errorMessage?: string | null;
}): AccountViewModel {
  if (!input.isAuthenticated) {
    return {
      title: 'Account',
      status: 'Sign in to OJ from the sidebar.',
      email: '',
      role: '',
      errorMessage: input.errorMessage ?? '',
      isAuthenticated: false
    };
  }

  return {
    title: 'Account',
    status: 'Logged in',
    email: input.email?.trim() || 'Not available',
    role: input.role?.trim() || 'Not available',
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

  if (!input.isAuthenticated) {
    return `<!doctype html>
<html lang="en">
  <body>
    <h2>${title}</h2>
    <p>${status}</p>
    ${errorMessage}
    <label for="oj-account-email">Email</label>
    <input id="oj-account-email" type="email" />
    <label for="oj-account-password">Password</label>
    <input id="oj-account-password" type="password" />
    <div>
      <button data-command="login">Login</button>
    </div>
    <script>
      const vscodeApi = acquireVsCodeApi();
      const emailInput = document.getElementById('oj-account-email');
      const passwordInput = document.getElementById('oj-account-password');
      const loginButton = document.querySelector('button[data-command="login"]');
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
  <body>
    <h2>${title}</h2>
    <p>${status}</p>
    ${errorMessage}
    <p><strong>Email:</strong> <code>${email}</code></p>
    <p><strong>Role:</strong> <code>${role}</code></p>
    <div>
      <button data-command="fetchProblems">Fetch Problems</button>
      <button data-command="logout">Logout</button>
    </div>
    <script>
      const vscodeApi = acquireVsCodeApi();
      for (const button of document.querySelectorAll('button[data-command]')) {
        button.addEventListener('click', () => {
          vscodeApi.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}
