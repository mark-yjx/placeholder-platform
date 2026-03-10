import fs from 'node:fs';
import path from 'node:path';

type WorkspacePackageJson = {
  workspaces?: unknown;
};

export function resolveRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        ) as WorkspacePackageJson;
        if (Array.isArray(packageJson.workspaces)) {
          return current;
        }
      } catch {
        // Keep walking upward until a valid workspace root is found.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error('Unable to resolve repository root');
}
