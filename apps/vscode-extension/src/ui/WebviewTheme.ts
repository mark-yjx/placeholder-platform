export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatCaseValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function createWebviewStyles(options?: { centered?: boolean }): string {
  const layoutStyles = options?.centered
    ? `
      body {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--vscode-sideBar-background);
      }

      .webview-shell {
        width: min(100%, 460px);
      }
    `
    : `
      body {
        background: var(--vscode-editor-background);
      }

      .webview-shell {
        max-width: 960px;
        margin: 0 auto;
      }
    `;

  return `
    :root {
      --spacing-1: 8px;
      --spacing-2: 12px;
      --spacing-3: 16px;
      --spacing-4: 24px;
      --spacing-5: 32px;
      --radius: 12px;
      --radius-lg: 14px;
      --surface: var(--vscode-editor-background);
      --surface-muted: var(--vscode-sideBar-background);
      --border: var(--vscode-editorWidget-border);
      --text-primary: var(--vscode-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --shadow: var(--vscode-widget-shadow);
      --font-system: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      --font-mono: var(--vscode-editor-font-family, ui-monospace, monospace);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: var(--spacing-4);
      color: var(--text-primary);
      font-family: var(--font-system);
      line-height: 1.55;
    }

    a,
    button,
    input,
    textarea,
    select,
    .section-card,
    .metric-card,
    .case-card {
      transition: all 120ms ease;
    }

    ${layoutStyles}

    .webview-shell,
    .section-stack,
    .field-stack,
    .case-stack,
    .metric-grid {
      display: grid;
      gap: var(--spacing-4);
    }

    .hero-card,
    .section-card,
    .metric-card,
    .case-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 8px 24px var(--shadow);
    }

    .hero-card,
    .section-card,
    .case-card {
      padding: var(--spacing-4);
    }

    .eyebrow,
    .section-kicker,
    .field-label {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.76rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3,
    h4,
    p {
      margin: 0;
    }

    .hero-title,
    .hero-card h2 {
      margin-top: var(--spacing-1);
      font-size: 1.7rem;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .hero-copy,
    .section-copy,
    .muted {
      color: var(--text-secondary);
    }

    .hero-copy {
      margin-top: var(--spacing-2);
    }

    .meta-grid,
    .metric-grid,
    .case-grid,
    .field-grid {
      display: grid;
      gap: var(--spacing-3);
    }

    .meta-grid,
    .metric-grid,
    .field-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .case-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .metric-card {
      padding: var(--spacing-3);
      min-height: 104px;
      align-content: start;
    }

    .metric-value {
      margin-top: var(--spacing-1);
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .section-header {
      display: grid;
      gap: var(--spacing-1);
      margin-bottom: var(--spacing-3);
    }

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      margin-top: var(--spacing-4);
    }

    .inline-meta {
      display: grid;
      gap: var(--spacing-2);
      margin-top: var(--spacing-4);
    }

    .inline-meta p {
      color: var(--text-secondary);
    }

    .inline-meta strong {
      color: var(--text-primary);
    }

    .markdown-content {
      display: grid;
      gap: var(--spacing-3);
    }

    .markdown-content ul,
    .markdown-content ol {
      margin: 0;
      padding-left: 1.3rem;
    }

    .markdown-content li + li {
      margin-top: var(--spacing-1);
    }

    code,
    pre {
      font-family: var(--font-mono);
    }

    code {
      padding: 0.12rem 0.36rem;
      border-radius: 10px;
      background: var(--vscode-textCodeBlock-background);
    }

    pre {
      margin: 0;
      padding: var(--spacing-3);
      overflow-x: auto;
      white-space: pre-wrap;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--vscode-textCodeBlock-background);
    }

    pre code {
      padding: 0;
      border-radius: 0;
      background: transparent;
    }

    .case-value {
      margin-top: var(--spacing-2);
    }

    .alert-card {
      display: grid;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-muted);
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      color: var(--text-secondary);
    }

    .field-stack label {
      display: grid;
      gap: var(--spacing-1);
      color: var(--text-secondary);
      font-size: 0.95rem;
    }

    vscode-text-field,
    vscode-checkbox {
      width: 100%;
    }

    .login-card {
      padding: var(--spacing-5) var(--spacing-4);
    }

    .login-actions {
      display: flex;
      justify-content: flex-start;
      gap: var(--spacing-2);
      margin-top: var(--spacing-2);
    }

    .error-text {
      color: var(--vscode-errorForeground);
    }
  `;
}
