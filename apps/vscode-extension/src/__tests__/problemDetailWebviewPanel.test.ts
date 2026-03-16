import test from 'node:test';
import assert from 'node:assert/strict';
import { ProblemDetailWebviewPanel } from '../ui/ProblemDetailWebviewProvider';

class FakeWebview {
  html = '';
  options?: { enableScripts?: boolean };
  private listener: ((message: unknown) => unknown) | null = null;

  onDidReceiveMessage(listener: (message: unknown) => unknown) {
    this.listener = listener;
    return { dispose: () => undefined };
  }

  async dispatch(message: unknown): Promise<void> {
    await this.listener?.(message);
  }
}

class FakePanel {
  readonly webview = new FakeWebview();
  title = 'Problem Detail';
  revealCount = 0;
  private disposeListener: (() => unknown) | null = null;

  reveal(): void {
    this.revealCount += 1;
  }

  onDidDispose(listener: () => unknown) {
    this.disposeListener = listener;
    return { dispose: () => undefined };
  }

  dispose(): void {
    this.disposeListener?.();
  }
}

function createProblem(problemId: string, title: string) {
  return {
    problemId,
    versionId: `${problemId}-v1`,
    title,
    statementMarkdown: `${title} statement.`,
    entryFunction: 'solve',
    starterCode: 'def solve():\n    raise NotImplementedError\n'
  };
}

test('problem detail panel opens in editor area and reuses the same panel for later selections', () => {
  const createdPanels: FakePanel[] = [];
  const detailPanel = new ProblemDetailWebviewPanel(
    {
      openStarterFile: async () => undefined,
      runPublicTests: async () => undefined,
      submitCurrentFile: async () => undefined,
      refreshProblem: async () => undefined
    },
    () => {
      const panel = new FakePanel();
      createdPanels.push(panel);
      return panel;
    }
  );

  detailPanel.showProblemDetail(createProblem('two-sum', 'Two Sum'));

  assert.equal(createdPanels.length, 1);
  assert.equal(createdPanels[0]?.webview.options?.enableScripts, true);
  assert.equal(createdPanels[0]?.title, 'Two Sum');
  assert.match(createdPanels[0]?.webview.html ?? '', /<h2>Two Sum<\/h2>/);

  detailPanel.showProblemDetail(createProblem('valid-parentheses', 'Valid Parentheses'));

  assert.equal(createdPanels.length, 1);
  assert.equal(createdPanels[0]?.revealCount, 1);
  assert.equal(createdPanels[0]?.title, 'Valid Parentheses');
  assert.match(createdPanels[0]?.webview.html ?? '', /<h2>Valid Parentheses<\/h2>/);
});

test('problem detail panel does not open an empty editor until a problem is selected', () => {
  let createPanelCount = 0;
  const panel = new FakePanel();
  const detailPanel = new ProblemDetailWebviewPanel(
    {
      openStarterFile: async () => undefined,
      runPublicTests: async () => undefined,
      submitCurrentFile: async () => undefined,
      refreshProblem: async () => undefined
    },
    () => {
      createPanelCount += 1;
      return panel;
    }
  );

  detailPanel.showProblemDetail(null);
  assert.equal(createPanelCount, 0);

  detailPanel.showProblemDetail(createProblem('two-sum', 'Two Sum'));
  detailPanel.showProblemDetail(null);

  assert.equal(createPanelCount, 1);
  assert.match(panel.webview.html, /<h2>Choose a problem<\/h2>/);
  assert.match(panel.webview.html, /Select a problem from the Problems list to view details\./);
});
