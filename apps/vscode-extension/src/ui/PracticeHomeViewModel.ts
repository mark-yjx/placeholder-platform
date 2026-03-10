import { createWebviewStyles, escapeHtml } from './WebviewTheme';

export type PracticeHomeViewModel = {
  title: string;
  subtitle: string;
  cardTitle: string;
  cardCopy: string;
  helperText: string;
  primaryAction: {
    command: 'signIn' | 'fetchProblems';
    label: string;
  };
  secondaryAction: {
    command: 'signUp';
    label: string;
  } | null;
  errorMessage: string;
};

export function createPracticeHomeViewModel(input: {
  isAuthenticated: boolean;
  errorMessage?: string | null;
}): PracticeHomeViewModel {
  if (!input.isAuthenticated) {
    return {
      title: 'Placeholder Practice',
      subtitle: 'Solve problems directly in VS Code.',
      cardTitle: 'Sign in to start practicing',
      cardCopy: 'Sign in to browse problems, open coding files, run public tests, and submit solutions.',
      helperText: 'Authentication opens in your browser and returns to VS Code automatically.',
      primaryAction: {
        command: 'signIn',
        label: 'Sign in'
      },
      secondaryAction: {
        command: 'signUp',
        label: 'Sign up'
      },
      errorMessage: input.errorMessage ?? ''
    };
  }

  return {
    title: 'Placeholder Practice',
    subtitle: 'No problems loaded yet.',
    cardTitle: 'Fetch problems to start practicing',
    cardCopy: 'Load the latest practice set, then choose a problem to read in the detail view and solve in your workspace.',
    helperText: 'Problems appear in the sidebar after the fetch completes.',
    primaryAction: {
      command: 'fetchProblems',
      label: 'Fetch Problems'
    },
    secondaryAction: null,
    errorMessage: input.errorMessage ?? ''
  };
}

export function createPracticeHomeHtml(input: PracticeHomeViewModel): string {
  const toolkitScript = 'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';
  const homeStyles = `
    body {
      padding: 16px 12px;
    }

    .practice-home-shell {
      max-width: 360px;
      margin: 0 auto;
      gap: 16px;
    }

    .practice-home-shell .home-intro,
    .practice-home-shell .home-card {
      display: grid;
      gap: 12px;
    }

    .practice-home-shell .home-intro {
      justify-items: center;
      text-align: center;
      padding: 8px 10px 0;
    }

    .practice-home-shell .home-card {
      padding: 20px 18px;
    }

    .practice-home-shell .home-title {
      font-size: 1.45rem;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }

    .practice-home-shell .home-copy,
    .practice-home-shell .home-helper {
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .practice-home-shell .home-actions {
      display: grid;
      gap: 10px;
    }

    .practice-home-shell .home-actions vscode-button::part(control) {
      justify-content: center;
      min-height: 40px;
    }

    .practice-home-shell .home-meta {
      display: grid;
      gap: 8px;
      padding-top: 2px;
    }
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script type="module" src="${toolkitScript}"></script>
    <style>
      ${createWebviewStyles()}
      ${homeStyles}
    </style>
  </head>
  <body>
    <main class="webview-shell section-stack practice-home-shell">
      <section class="home-intro">
        <p class="eyebrow">Placeholder Practice</p>
        <h2 class="home-title">${escapeHtml(input.title)}</h2>
        <p class="home-copy">${escapeHtml(input.subtitle)}</p>
      </section>

      <section class="hero-card home-card">
        <div class="section-header">
          <h3>${escapeHtml(input.cardTitle)}</h3>
          <p class="section-copy">${escapeHtml(input.cardCopy)}</p>
        </div>
        ${
          input.errorMessage
            ? `<div class="alert-card error-text"><p role="alert">${escapeHtml(input.errorMessage)}</p></div>`
            : ''
        }
        <div class="home-actions">
          <vscode-button appearance="primary" data-command="${input.primaryAction.command}">${escapeHtml(
            input.primaryAction.label
          )}</vscode-button>
          ${
            input.secondaryAction
              ? `<vscode-button data-command="${input.secondaryAction.command}">${escapeHtml(
                  input.secondaryAction.label
                )}</vscode-button>`
              : ''
          }
        </div>
        <div class="home-meta">
          <p class="home-helper">${escapeHtml(input.helperText)}</p>
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
