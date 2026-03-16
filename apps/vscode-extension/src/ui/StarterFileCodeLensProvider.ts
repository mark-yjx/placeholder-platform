import type * as vscode from 'vscode';

const STARTER_FILE_PATTERN = /(?:^|[\\/])\.oj[\\/]problems[\\/]([^\\/]+)\.py$/i;

export function resolveStarterFileProblemId(fileName: string | undefined): string | null {
  const normalizedFileName = fileName?.trim() ?? '';
  if (!normalizedFileName) {
    return null;
  }

  const match = normalizedFileName.match(STARTER_FILE_PATTERN);
  return match?.[1]?.trim() || null;
}

export class StarterFileCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): readonly vscode.CodeLens[] {
    if (document.languageId.trim().toLowerCase() !== 'python') {
      return [];
    }

    const problemId = resolveStarterFileProblemId(document.fileName);
    if (!problemId) {
      return [];
    }

    const api = require('vscode') as typeof import('vscode');
    const range = new api.Range(0, 0, 0, 0);
    return [
      new api.CodeLens(range, {
        title: 'Run Public Tests',
        command: 'oj.practice.runPublicTests',
        arguments: [problemId]
      }),
      new api.CodeLens(range, {
        title: 'Submit',
        command: 'oj.practice.submitCurrentFile',
        arguments: [problemId]
      })
    ];
  }
}
