function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const ALLOWED_CALLBACK_SCHEMES = new Set(['vscode', 'vscode-insiders']);
const ALLOWED_CALLBACK_AUTHORITIES = new Set([
  'placeholder.placeholder-extension',
  'local.placeholder-extension'
]);
const STUDENT_AUTH_CALLBACK_PATH = '/auth-complete';

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isAllowedStudentCallbackTarget(parsed: URL): boolean {
  const scheme = parsed.protocol.replace(/:$/, '');
  return (
    ALLOWED_CALLBACK_SCHEMES.has(scheme) &&
    ALLOWED_CALLBACK_AUTHORITIES.has(parsed.host) &&
    normalizePath(parsed.pathname) === STUDENT_AUTH_CALLBACK_PATH
  );
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
}

function isAllowedExternalStudentCallback(parsed: URL): boolean {
  if (parsed.protocol === 'https:') {
    return parsed.host.trim().length > 0;
  }

  return parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname);
}

function parseStudentCallbackUri(callbackUri: string): URL {
  const parsed = new URL(callbackUri);
  const decodedPathname = decodeURIComponent(parsed.pathname);
  const queryStart = decodedPathname.indexOf('?');
  const hashStart = decodedPathname.indexOf('#');
  const splitIndex =
    queryStart === -1
      ? hashStart
      : hashStart === -1
        ? queryStart
        : Math.min(queryStart, hashStart);

  if (splitIndex === -1) {
    return parsed;
  }

  const normalized = new URL(parsed.toString());
  normalized.pathname = decodedPathname.slice(0, splitIndex);

  const queryEnd = hashStart === -1 ? decodedPathname.length : hashStart;
  normalized.search = queryStart === -1 ? parsed.search : decodedPathname.slice(queryStart, queryEnd);
  normalized.hash = hashStart === -1 ? parsed.hash : decodedPathname.slice(hashStart);
  return normalized;
}

function resolveDirectStudentCallbackUri(callbackUri: string): string | null {
  let parsed: URL;
  try {
    parsed = parseStudentCallbackUri(callbackUri);
  } catch {
    return null;
  }

  if (isAllowedStudentCallbackTarget(parsed)) {
    return parsed.toString();
  }

  const target = parsed.searchParams.get('target')?.trim() ?? '';
  if (!target) {
    return null;
  }

  try {
    const targetUri = parseStudentCallbackUri(target);
    return isAllowedStudentCallbackTarget(targetUri) ? targetUri.toString() : null;
  } catch {
    return null;
  }
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
        --bg: #f5f1ea;
        --bg-glow: rgba(223, 212, 196, 0.45);
        --panel: rgba(255, 252, 247, 0.94);
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
        padding: var(--space-5) var(--space-4);
      }
      main {
        width: min(100%, 520px);
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 2.5rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        line-height: 1.6;
      }
      a {
        color: inherit;
      }
      .muted {
        color: var(--muted);
      }
      .page-shell {
        display: grid;
        gap: var(--space-5);
      }
      .intro {
        display: grid;
        gap: var(--space-2);
        justify-items: center;
        text-align: center;
      }
      .support-copy {
        max-width: 28ch;
      }
      .card {
        display: grid;
        gap: 20px;
        padding: 28px;
        border: 1px solid var(--border);
        border-radius: var(--radius-xl);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0)),
          var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
      }
      .form-card {
        gap: var(--space-4);
      }
      .error {
        background: var(--error-bg);
        color: var(--error-text);
        border: 1px solid rgba(157, 51, 38, 0.14);
        border-radius: var(--radius);
        padding: 14px 16px;
      }
      form {
        display: grid;
        gap: 18px;
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
      button,
      .button-link {
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
        width: 100%;
      }
      button:hover,
      .button-link:hover {
        background: var(--accent-strong);
      }
      .actions {
        display: grid;
        gap: var(--space-2);
      }
      .secondary-nav {
        display: grid;
        gap: 6px;
      }
      .secondary-nav p {
        color: var(--muted);
      }
      .secondary-nav a {
        color: var(--accent-strong);
        font-weight: 600;
        text-decoration: none;
      }
      .secondary-nav a:hover {
        text-decoration: underline;
      }
      .success-mark {
        width: 54px;
        height: 54px;
        border-radius: 999px;
        display: inline-grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 1.45rem;
        font-weight: 700;
      }
      .success-card {
        justify-items: center;
        text-align: center;
      }
      .card-copy {
        color: var(--text);
        font-size: 1rem;
      }
      .helper-copy {
        color: var(--muted);
        max-width: 34ch;
      }
      .success-card .actions {
        width: min(100%, 240px);
      }
      .fallback-block {
        display: grid;
        gap: 12px;
        width: 100%;
        padding-top: 4px;
      }
      .fallback-label {
        color: var(--muted);
        font-size: 0.95rem;
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
        color: var(--muted);
      }
      .footer-link a {
        color: var(--accent-strong);
        text-decoration: none;
      }
      .footer-link a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="page-shell">${input.body}</div>
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
  ojState?: string | null;
}): string {
  const pageTitle = input.mode === 'sign-in' ? 'Placeholder Practice Sign In' : 'Placeholder Practice Sign Up';
  const action = input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up';
  const secondaryHref = input.mode === 'sign-in' ? '/auth/sign-up' : '/auth/sign-in';
  const secondaryLabel = input.mode === 'sign-in' ? 'Sign up' : 'Sign in';
  const secondaryPrompt = input.mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?';
  const supportCopy =
    input.mode === 'sign-in'
      ? 'Sign in to continue solving problems in VS Code.'
      : 'Create your account to start solving problems.';
  const errorMessage = input.errorMessage ? `<div class="error">${escapeHtml(input.errorMessage)}</div>` : '';
  const email = escapeHtml(input.values?.email ?? '');
  const displayName = escapeHtml(input.values?.displayName ?? '');
  const callbackUri = input.callbackUri ? escapeHtml(input.callbackUri) : '';
  const ojState = input.ojState ? escapeHtml(input.ojState) : '';
  const callbackFields =
    callbackUri && ojState
      ? `
        <input type="hidden" name="callbackUri" value="${callbackUri}" />
        <input type="hidden" name="oj_state" value="${ojState}" />
      `
      : '';

  return renderLayout({
    title: pageTitle,
    body: `
      <div class="intro">
        <h1>Placeholder Practice</h1>
        <p class="muted support-copy">${escapeHtml(supportCopy)}</p>
      </div>
      <section class="card form-card">
        ${errorMessage}
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
        <div class="secondary-nav">
          <p>${secondaryPrompt}</p>
          <p><a href="${secondaryHref}">${secondaryLabel}</a></p>
        </div>
      </section>
    `
  });
}

export function renderStudentAuthSuccess(input: {
  mode: 'sign-in' | 'sign-up';
  email: string;
  code: string;
  expiresAt: string;
}): string {
  return renderLayout({
    title: 'Success',
    body: `
      <div class="intro">
        <div class="success-mark" aria-hidden="true">✓</div>
        <h1>Success</h1>
        <p class="muted support-copy">Your account is ready.</p>
      </div>
      <section class="card success-card">
        <p class="card-copy">Return to VS Code to finish signing in.</p>
        <div class="fallback-block">
          <p class="fallback-label">
            If you need the manual fallback, enter this one-time code in VS Code before
            ${escapeHtml(new Date(input.expiresAt).toLocaleString('en-AU', { hour12: false, timeZone: 'UTC' }))} UTC.
          </p>
          <div class="code-block">${escapeHtml(input.code)}</div>
        </div>
        <p class="footer-link">
          <a href="${input.mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}">Start again</a>
        </p>
      </section>
    `
  });
}

export function resolveStudentAuthCallback(input: {
  callbackUri?: string | null;
  ojState?: string | null;
}): { callbackUri: string; ojState: string } | null {
  const callbackUri = input.callbackUri?.trim() ?? '';
  const ojState = input.ojState?.trim() ?? '';

  if (!callbackUri && !ojState) {
    return null;
  }

  if (!callbackUri || !ojState) {
    throw new Error('Browser callback configuration is incomplete. Start again from the VS Code extension.');
  }

  let parsed: URL;
  try {
    parsed = parseStudentCallbackUri(callbackUri);
  } catch {
    throw new Error('Browser callback target is invalid. Start again from the VS Code extension.');
  }

  if (!isAllowedStudentCallbackTarget(parsed) && !isAllowedExternalStudentCallback(parsed)) {
    throw new Error('Browser callback target is invalid. Start again from the VS Code extension.');
  }

  return { callbackUri: parsed.toString(), ojState };
}

export function createStudentAuthCompletionUri(input: {
  callbackUri: string;
  ojState: string;
  code: string;
}): string {
  const callbackUrl = new URL(input.callbackUri);
  callbackUrl.searchParams.set('code', input.code);
  callbackUrl.searchParams.set('oj_state', input.ojState);
  return callbackUrl.toString();
}

export function renderStudentAuthCallbackRedirect(input: {
  mode: 'sign-in' | 'sign-up';
  email: string;
  code: string;
  expiresAt: string;
  callbackUri: string;
  ojState: string;
}): string {
  const completionUri = createStudentAuthCompletionUri({
    callbackUri: input.callbackUri,
    ojState: input.ojState,
    code: input.code
  });
  const directCallbackUri = resolveDirectStudentCallbackUri(input.callbackUri);
  const directCompletionUri = directCallbackUri
    ? createStudentAuthCompletionUri({
        callbackUri: directCallbackUri,
        ojState: input.ojState,
        code: input.code
      })
    : null;
  const primaryOpenUri = directCompletionUri ?? completionUri;
  const escapedPrimaryOpenUri = escapeHtml(primaryOpenUri);
  const escapedCompletionUri = escapeHtml(completionUri);
  const autoOpenScript = JSON.stringify(completionUri);

  return renderLayout({
    title: 'Success',
    body: `
      <div class="intro">
        <div class="success-mark" aria-hidden="true">✓</div>
        <h1>Success</h1>
        <p class="muted support-copy">Your account is ready.</p>
      </div>
      <section class="card success-card">
        <p class="card-copy">Returning to VS Code...</p>
        <p class="helper-copy">If nothing happens automatically, use the button below to open the app directly.</p>
        <div class="actions">
          <a class="button-link" href="${escapedPrimaryOpenUri}">Open VS Code</a>
        </div>
        ${
          directCompletionUri && directCompletionUri !== completionUri
            ? `<p class="footer-link"><a href="${escapedCompletionUri}">Try remote callback link instead</a></p>`
            : ''
        }
        <div class="fallback-block">
          <p class="fallback-label">
            If you need the manual fallback, this code works until
            ${escapeHtml(new Date(input.expiresAt).toLocaleString('en-AU', { hour12: false, timeZone: 'UTC' }))} UTC.
          </p>
          <div class="code-block">${escapeHtml(input.code)}</div>
        </div>
      </section>
      <noscript>
        <p class="footer-link">JavaScript is disabled. Use the Open VS Code button above, or enter the browser code manually in VS Code.</p>
      </noscript>
      <script>
        window.location.replace(${autoOpenScript});
      </script>
    `
  });
}
