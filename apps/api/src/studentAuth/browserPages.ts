function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const ALLOWED_CALLBACK_SCHEMES = new Set(['vscode', 'vscode-insiders']);
const ALLOWED_CALLBACK_AUTHORITIES = new Set(['local.oj-vscode-extension']);

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
        --bg: #f5f1ea;
        --bg-glow: rgba(223, 212, 196, 0.45);
        --panel: rgba(255, 252, 247, 0.94);
        --panel-soft: rgba(248, 242, 234, 0.88);
        --text: #201b17;
        --muted: #6c655e;
        --border: rgba(122, 111, 98, 0.18);
        --accent: #286f63;
        --accent-strong: #1f5a50;
        --accent-soft: rgba(40, 111, 99, 0.12);
        --error-bg: #fff3ef;
        --error-text: #9d3326;
        --shadow: 0 20px 48px rgba(39, 31, 25, 0.08);
        --radius-xl: 28px;
        --radius-lg: 20px;
        --radius: 16px;
        --space-1: 8px;
        --space-2: 12px;
        --space-3: 16px;
        --space-4: 24px;
        --space-5: 32px;
        --font-system: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: var(--font-system);
        background:
          radial-gradient(circle at top, var(--bg-glow), transparent 38%),
          linear-gradient(180deg, #faf7f1 0%, var(--bg) 100%);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: var(--space-4);
      }
      main {
        width: min(100%, 540px);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius-xl);
        padding: var(--space-5);
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        font-size: clamp(2rem, 5vw, 2.4rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
        margin: var(--space-1) 0 0;
      }
      p {
        margin: 0;
        line-height: 1.6;
      }
      .muted {
        color: var(--muted);
      }
      .stack {
        display: grid;
        gap: var(--space-4);
      }
      .intro {
        display: grid;
        gap: var(--space-2);
      }
      .error {
        background: var(--error-bg);
        color: var(--error-text);
        border: 1px solid rgba(157, 51, 38, 0.14);
        border-radius: var(--radius);
        padding: 14px 16px;
      }
      .section {
        display: grid;
        gap: var(--space-3);
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0)),
          var(--panel-soft);
      }
      .section-title {
        margin: 0;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      form {
        display: grid;
        gap: var(--space-3);
      }
      label {
        display: grid;
        gap: 7px;
        font-weight: 600;
        color: var(--text);
      }
      input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 14px 16px;
        font: inherit;
        background: rgba(255, 255, 255, 0.88);
        color: var(--text);
      }
      input:focus {
        outline: 3px solid var(--accent-soft);
        border-color: var(--accent);
      }
      button, .button-link {
        appearance: none;
        border: none;
        border-radius: var(--radius);
        background: var(--accent);
        color: #fff;
        font: inherit;
        font-weight: 700;
        padding: 14px 18px;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
        display: inline-block;
      }
      button:hover, .button-link:hover {
        background: var(--accent-strong);
      }
      .button-link.secondary {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
      }
      .code-block {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 1.05rem;
        letter-spacing: 0.14em;
        font-weight: 700;
        border: 1px dashed rgba(122, 111, 98, 0.32);
        border-radius: var(--radius);
        padding: 16px 18px;
        text-align: center;
        background: rgba(255, 255, 255, 0.82);
        color: var(--text);
      }
      .footer-link {
        font-size: 0.95rem;
        text-align: center;
      }
      .footer-link a {
        color: var(--accent-strong);
        text-decoration: none;
      }
      .footer-link a:hover {
        text-decoration: underline;
      }
      .actions {
        display: grid;
        gap: var(--space-2);
      }
      .support-copy {
        max-width: 42ch;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="stack">${input.body}</div>
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
  callbackUri?: string | null;
  state?: string | null;
}): string {
  const title = input.mode === 'sign-in' ? 'Welcome back' : 'Create your student account';
  const pageTitle = input.mode === 'sign-in' ? 'OJ Practice Sign In' : 'OJ Practice Sign Up';
  const action = input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up';
  const secondaryHref = input.mode === 'sign-in' ? '/auth/sign-up' : '/auth/sign-in';
  const secondaryLabel = input.mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in';
  const supportCopy =
    input.mode === 'sign-in'
      ? 'Sign in to sync your account, fetch problems, and submit solutions.'
      : 'Set up OJ Practice once, then return to VS Code and keep working from the same student account.';
  const errorMessage = input.errorMessage ? `<div class="error">${escapeHtml(input.errorMessage)}</div>` : '';
  const email = escapeHtml(input.values?.email ?? '');
  const displayName = escapeHtml(input.values?.displayName ?? '');
  const callbackUri = input.callbackUri ? escapeHtml(input.callbackUri) : '';
  const state = input.state ? escapeHtml(input.state) : '';
  const callbackFields =
    callbackUri && state
      ? `
        <input type="hidden" name="callbackUri" value="${callbackUri}" />
        <input type="hidden" name="state" value="${state}" />
      `
      : '';

  return renderLayout({
    title: pageTitle,
    body: `
      <div class="intro">
        <p class="eyebrow">OJ Practice</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted support-copy">${escapeHtml(supportCopy)}</p>
      </div>
      ${errorMessage}
      <section class="section">
        <p class="section-title">${input.mode === 'sign-in' ? 'Student Sign In' : 'Student Sign Up'}</p>
        <form method="post" action="${action}">
          ${callbackFields}
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
      </section>
      <section class="section">
        <p class="section-title">Continue In VS Code</p>
        <p class="muted">Authentication opens in your browser and returns to VS Code automatically when it is ready.</p>
      </section>
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
  const title = input.mode === 'sign-in' ? 'Return to VS Code' : 'Return to VS Code';

  return renderLayout({
    title,
    body: `
      <div class="intro">
        <p class="eyebrow">OJ Practice</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted support-copy">
          ${input.mode === 'sign-in' ? 'You are signed in' : 'Your student account is ready'} for
          <strong>${escapeHtml(input.email)}</strong>. Head back to VS Code and enter this one-time code to finish.
        </p>
      </div>
      <section class="section">
        <p class="section-title">Browser Code</p>
        <p class="muted">
          This fallback code expires at
          ${escapeHtml(new Date(input.expiresAt).toLocaleString('en-AU', { hour12: false, timeZone: 'UTC' }))} UTC.
        </p>
        <div class="code-block">${escapeHtml(input.code)}</div>
      </section>
      <p class="footer-link"><a href="${input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}">Start again</a></p>
    `
  });
}

export function resolveStudentAuthCallback(input: {
  callbackUri?: string | null;
  state?: string | null;
}): { callbackUri: string; state: string } | null {
  const callbackUri = input.callbackUri?.trim() ?? '';
  const state = input.state?.trim() ?? '';

  if (!callbackUri && !state) {
    return null;
  }

  if (!callbackUri || !state) {
    throw new Error('Browser callback configuration is incomplete. Start again from the VS Code extension.');
  }

  let parsed: URL;
  try {
    parsed = new URL(callbackUri);
  } catch {
    throw new Error('Browser callback target is invalid. Start again from the VS Code extension.');
  }

  if (!ALLOWED_CALLBACK_SCHEMES.has(parsed.protocol.replace(/:$/, ''))) {
    throw new Error('Browser callback target is invalid. Start again from the VS Code extension.');
  }

  if (!ALLOWED_CALLBACK_AUTHORITIES.has(parsed.host)) {
    throw new Error('Browser callback target is invalid. Start again from the VS Code extension.');
  }

  return { callbackUri, state };
}

export function createStudentAuthCompletionUri(input: {
  callbackUri: string;
  state: string;
  code: string;
}): string {
  const callbackUrl = new URL(input.callbackUri);
  callbackUrl.searchParams.set('code', input.code);
  callbackUrl.searchParams.set('state', input.state);
  return callbackUrl.toString();
}

export function renderStudentAuthCallbackRedirect(input: {
  mode: 'sign-in' | 'sign-up';
  email: string;
  code: string;
  expiresAt: string;
  callbackUri: string;
  state: string;
}): string {
  const title = 'Return to VS Code';
  const completionUri = createStudentAuthCompletionUri({
    callbackUri: input.callbackUri,
    state: input.state,
    code: input.code
  });
  const escapedCompletionUri = escapeHtml(completionUri);
  const autoOpenScript = JSON.stringify(completionUri);

  return renderLayout({
    title,
    body: `
      <div class="intro">
        <p class="eyebrow">OJ Practice</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted support-copy">
          ${input.mode === 'sign-in' ? 'You are signed in' : 'Your student account is ready'} for
          <strong>${escapeHtml(input.email)}</strong>. We are sending you back to VS Code now.
        </p>
      </div>
      <section class="section">
        <p class="section-title">Continue</p>
        <p class="muted">If VS Code does not open automatically, use the button below to return. The browser code stays available as a backup.</p>
        <div class="actions">
          <a class="button-link" href="${escapedCompletionUri}">Return to VS Code</a>
        </div>
      </section>
      <section class="section">
        <p class="section-title">Fallback Code</p>
        <p class="muted">
          Use this only if VS Code stays in the background. It expires at
          ${escapeHtml(new Date(input.expiresAt).toLocaleString('en-AU', { hour12: false, timeZone: 'UTC' }))} UTC.
        </p>
        <div class="code-block">${escapeHtml(input.code)}</div>
      </section>
      <script>
        window.location.replace(${autoOpenScript});
      </script>
      <noscript>
        <p class="muted">JavaScript is disabled. Use the Return to VS Code button above, or enter the fallback code manually in VS Code.</p>
      </noscript>
    `
  });
}
