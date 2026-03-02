import { mkdir, writeFile } from 'node:fs/promises';
import { access, constants } from 'node:fs';
import path from 'node:path';

type WorkspaceFolderLike = {
  uri: {
    fsPath: string;
  };
};

type TextDocumentLike = {
  getText(): string;
  languageId: string;
  fileName?: string;
};

type ProblemStarterWindowLike = {
  showTextDocument: (
    document: TextDocumentLike,
    options?: { preview?: boolean }
  ) => Promise<unknown>;
  showWarningMessage?: <T extends string>(
    message: string,
    options: { modal: boolean },
    ...items: readonly T[]
  ) => Promise<T | undefined>;
};

type ProblemStarterWorkspaceLike = {
  workspaceFolders?: readonly WorkspaceFolderLike[];
  openTextDocument: (uriOrPath: string) => Promise<TextDocumentLike>;
};

async function pathExists(targetPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    access(targetPath, constants.F_OK, (error) => {
      resolve(error === null);
    });
  });
}

export class ProblemStarterWorkspace {
  constructor(
    private readonly window: ProblemStarterWindowLike,
    private readonly workspace: ProblemStarterWorkspaceLike
  ) {}

  async openProblemStarter(problem: { problemId: string; starterCode?: string }): Promise<void> {
    const workspaceRoot = this.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('Open a workspace folder before opening a problem');
    }

    const starterCode = problem.starterCode;
    if (!starterCode?.trim()) {
      throw new Error('Problem starter code is unavailable');
    }

    const problemDirectory = path.join(workspaceRoot, '.oj', 'problems');
    const problemPath = path.join(problemDirectory, `${problem.problemId}.py`);

    await mkdir(problemDirectory, { recursive: true });

    const exists = await pathExists(problemPath);
    if (!exists) {
      await writeFile(problemPath, starterCode, 'utf8');
    } else {
      const overwrite = await this.window.showWarningMessage?.(
        `Overwrite existing starter file for ${problem.problemId}?`,
        { modal: true },
        'Overwrite'
      );

      if (overwrite === 'Overwrite') {
        await writeFile(problemPath, starterCode, 'utf8');
      }
    }

    const document = await this.workspace.openTextDocument(problemPath);
    await this.window.showTextDocument(document, { preview: false });
  }
}
