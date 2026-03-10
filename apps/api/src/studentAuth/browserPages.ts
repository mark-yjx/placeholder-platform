function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLayout(input: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --panel: #fffdfa;
        --text: #1f1b16;
        --muted: #6b6258;
        --border: #d7ccbc;
        --accent: #1b7f6a;
        --accent-strong: #145f50;
        --error-bg: #fff2ef;
        --error-text: #9f2a1e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      main {
        width: min(100%, 460px);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 18px 44px rgba(31, 27, 22, 0.08);
      }
      h1 {
        font-size: 1.8rem;
        margin: 0 0 10px;
      }
      p {
        margin: 0 0 16px;
        line-height: 1.5;
      }
      .muted {
        color: var(--muted);
      }
      .error {
        background: var(--error-bg);
        color: var(--error-text);
        border: 1px solid rgba(159, 42, 30, 0.2);
        border-radius: 14px;
        padding: 12px 14px;
        margin-bottom: 16px;
      }
      form {
        display: grid;
        gap: 14px;
      }
      label {
        display: grid;
        gap: 6px;
        font-weight: 600;
      }
      input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        background: #fff;
        color: var(--text);
      }
      input:focus {
        outline: 2px solid rgba(27, 127, 106, 0.18);
        border-color: var(--accent);
      }
      button, .button-link {
        appearance: none;
        border: none;
        border-radius: 12px;
        background: var(--accent);
        color: #fff;
        font: inherit;
        font-weight: 700;
        padding: 12px 16px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
        display: inline-block;
      }
      button:hover, .button-link:hover {
        background: var(--accent-strong);
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .code-block {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 1.2rem;
        letter-spacing: 0.18em;
        font-weight: 700;
        border: 1px dashed var(--border);
        border-radius: 16px;
        padding: 16px;
        text-align: center;
        background: #fff;
      }
      .footer-link {
        margin-top: 18px;
        font-size: 0.95rem;
      }
      .footer-link a {
        color: var(--accent-strong);
      }
    </style>
  </head>
  <body>
    <main>
      ${input.body}
    </main>
  </body>
</html>`;
}

export function renderStudentAuthForm(input: {
  mode: 'sign-in' | 'sign-up';
  errorMessage?: string | null;
  values?: {
    email?: string;
    displayName?: string;
  };
}): string {
  const title = input.mode === 'sign-in' ? 'Student Sign In' : 'Student Sign Up';
  const action = input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up';
  const secondaryHref = input.mode === 'sign-in' ? '/auth/sign-up' : '/auth/sign-in';
  const secondaryLabel = input.mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in';
  const errorMessage = input.errorMessage ? `<div class="error">${escapeHtml(input.errorMessage)}</div>` : '';
  const email = escapeHtml(input.values?.email ?? '');
  const displayName = escapeHtml(input.values?.displayName ?? '');

  return renderLayout({
    title,
    body: `
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">
        Complete student authentication in the browser, then paste the one-time code back into the VS Code extension.
      </p>
      ${errorMessage}
      <form method="post" action="${action}">
        <label>
          <span>Email</span>
          <input type="email" name="email" value="${email}" autocomplete="email" required />
        </label>
        ${input.mode === 'sign-up'
          ? `<label>
              <span>Display name</span>
              <input type="text" name="displayName" value="${displayName}" autocomplete="name" required />
            </label>`
          : ''}
        <label>
          <span>Password</span>
          <input type="password" name="password" autocomplete="${
            input.mode === 'sign-in' ? 'current-password' : 'new-password'
          }" required />
        </label>
        ${input.mode === 'sign-up'
          ? `<label>
              <span>Confirm password</span>
              <input type="password" name="confirmPassword" autocomplete="new-password" required />
            </label>`
          : ''}
        <button type="submit">${input.mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p class="footer-link"><a href="${secondaryHref}">${secondaryLabel}</a></p>
    `
  });
}

export function renderStudentAuthSuccess(input: {
  mode: 'sign-in' | 'sign-up';
  email: string;
  code: string;
  expiresAt: string;
}): string {
  const title = input.mode === 'sign-in' ? 'Student Sign In Complete' : 'Student Account Created';

  return renderLayout({
    title,
    body: `
      <h1>${escapeHtml(title)}</h1>
      <p>
        ${input.mode === 'sign-in' ? 'Authentication succeeded' : 'Your student account is ready'} for
        <strong>${escapeHtml(input.email)}</strong>.
      </p>
      <p class="muted">
        Return to the VS Code extension and paste this one-time sign-in code. It expires at
        ${escapeHtml(new Date(input.expiresAt).toLocaleString('en-AU', { hour12: false, timeZone: 'UTC' }))} UTC.
      </p>
      <div class="code-block">${escapeHtml(input.code)}</div>
      <div class="stack">
        <p class="muted">Next step in VS Code: choose the prompt that opened after Sign in / Sign up and paste the code exactly once.</p>
        <a class="button-link" href="${input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}">Start again</a>
      </div>
    `
  });
}
