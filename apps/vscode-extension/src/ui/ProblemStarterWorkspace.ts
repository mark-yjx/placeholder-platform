import { mkdir, writeFile } from 'node:fs/promises';
import { access, constants } from 'node:fs';
import path from 'node:path';
import { resolveProblemStatementMarkdown } from './PracticeViewState';

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

  async openProblemStarter(problem: {
    problemId: string;
    starterCode?: string;
    statementMarkdown?: string;
    statement?: string;
  }): Promise<string> {
    const workspaceRoot = this.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('Open a workspace folder before opening a problem');
    }

    const starterCode = problem.starterCode;
    if (!starterCode?.trim()) {
      throw new Error('Problem starter code is unavailable');
    }
    const starterFileContent = formatStarterFileContent(
      starterCode,
      resolveProblemStatementMarkdown(problem) ?? problem.statement?.trim() ?? undefined
    );

    const problemDirectory = path.join(workspaceRoot, '.oj', 'problems');
    const problemPath = path.join(problemDirectory, `${problem.problemId}.py`);

    await mkdir(problemDirectory, { recursive: true });

    const exists = await pathExists(problemPath);
    if (!exists) {
      await writeFile(problemPath, starterFileContent, 'utf8');
    } else {
      const overwrite = await this.window.showWarningMessage?.(
        `Overwrite existing starter file for ${problem.problemId}?`,
        { modal: true },
        'Overwrite'
      );

      if (overwrite === 'Overwrite') {
        await writeFile(problemPath, starterFileContent, 'utf8');
      }
    }

    const document = await this.workspace.openTextDocument(problemPath);
    await this.window.showTextDocument(document, { preview: false });
    return problemPath;
  }

  async reopenProblemStarter(filePath: string): Promise<void> {
    const normalizedPath = filePath.trim();
    if (!normalizedPath) {
      throw new Error('Starter file path is required');
    }

    const document = await this.workspace.openTextDocument(normalizedPath);
    await this.window.showTextDocument(document, { preview: false });
  }
}

function formatStarterFileContent(starterCode: string, statement?: string): string {
  const normalizedStarter = starterCode.endsWith('\n') ? starterCode : `${starterCode}\n`;
  const trimmedStatement = statement?.trim();
  if (!trimmedStatement) {
    return normalizedStarter;
  }

  const commentBlock = trimmedStatement
    .split(/\r?\n/)
    .map((line) => `# ${line}`)
    .join('\n');

  return `${commentBlock}\n\n${normalizedStarter}`;
}
