import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type ExtractedBlock =
  | {
      kind: 'import';
      start: number;
      code: string;
      introducedNames: readonly string[];
      hasWildcard: boolean;
      isFutureImport: boolean;
    }
  | {
      kind: 'constant';
      start: number;
      code: string;
      name: string;
      references: readonly string[];
    }
  | {
      kind: 'function';
      start: number;
      code: string;
      name: string;
      references: readonly string[];
    }
  | {
      kind: 'ignored';
      start: number;
      code: string;
    };

export type ExtractPythonSubmissionRequest = {
  sourceCode: string;
  entryFunction: string;
};

export type ExtractPythonSubmissionResult = {
  selectedEntrypoint: string;
  extractedSourceCode: string;
};

const PYTHON_AST_EXTRACTOR = String.raw`
import ast
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    source = handle.read()

try:
    module = ast.parse(source)
except SyntaxError as exc:
    raise SystemExit(str(exc))

lines = source.splitlines()

def slice_source(node):
    segment = ast.get_source_segment(source, node)
    if segment is not None:
        return segment.rstrip() + "\n"
    start = max(getattr(node, "lineno", 1) - 1, 0)
    end = max(getattr(node, "end_lineno", getattr(node, "lineno", 1)), 1)
    return "\n".join(lines[start:end]).rstrip() + "\n"

def is_main_guard(test):
    return (
        isinstance(test, ast.Compare)
        and isinstance(test.left, ast.Name)
        and test.left.id == "__name__"
        and len(test.ops) == 1
        and isinstance(test.ops[0], ast.Eq)
        and len(test.comparators) == 1
        and isinstance(test.comparators[0], ast.Constant)
        and test.comparators[0].value == "__main__"
    )

class ReferenceCollector(ast.NodeVisitor):
    def __init__(self):
        self.references = set()

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self.references.add(node.id)
        self.generic_visit(node)

def collect_references(node):
    collector = ReferenceCollector()
    collector.visit(node)
    return sorted(collector.references)

blocks = []
for node in module.body:
    start = getattr(node, "lineno", 1) - 1
    code = slice_source(node)

    if isinstance(node, ast.Import):
        introduced = []
        for alias in node.names:
            if alias.asname:
                introduced.append(alias.asname)
            else:
                introduced.append(alias.name.split(".", 1)[0])
        blocks.append({
            "kind": "import",
            "start": start,
            "code": code,
            "introducedNames": introduced,
            "hasWildcard": False,
            "isFutureImport": False,
        })
        continue

    if isinstance(node, ast.ImportFrom):
        introduced = []
        has_wildcard = False
        for alias in node.names:
            if alias.name == "*":
                has_wildcard = True
                continue
            introduced.append(alias.asname or alias.name)
        blocks.append({
            "kind": "import",
            "start": start,
            "code": code,
            "introducedNames": introduced,
            "hasWildcard": has_wildcard,
            "isFutureImport": node.module == "__future__",
        })
        continue

    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        references = [name for name in collect_references(node) if name != node.name]
        blocks.append({
            "kind": "function",
            "start": start,
            "code": code,
            "name": node.name,
            "references": references,
        })
        continue

    if isinstance(node, ast.If) and is_main_guard(node.test):
        blocks.append({
            "kind": "ignored",
            "start": start,
            "code": code,
        })
        continue

    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        references = [ref for ref in collect_references(node) if ref != name]
        blocks.append({
            "kind": "constant",
            "start": start,
            "code": code,
            "name": name,
            "references": references,
        })
        continue

    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value is not None:
        name = node.target.id
        references = [ref for ref in collect_references(node) if ref != name]
        blocks.append({
            "kind": "constant",
            "start": start,
            "code": code,
            "name": name,
            "references": references,
        })
        continue

    blocks.append({
        "kind": "ignored",
        "start": start,
        "code": code,
    })

json.dump(blocks, sys.stdout)
`;

let cachedPythonCommand: string | null | undefined;

function resolvePythonCommand(): string | null {
  if (cachedPythonCommand !== undefined) {
    return cachedPythonCommand;
  }

  for (const candidate of ['python3', 'python']) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      cachedPythonCommand = candidate;
      return cachedPythonCommand;
    }
  }

  cachedPythonCommand = null;
  return cachedPythonCommand;
}

function parseTopLevelBlocks(sourceCode: string): readonly ExtractedBlock[] {
  const python = resolvePythonCommand();
  if (!python) {
    throw new Error('Python interpreter unavailable for AST submission extraction');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-python-extract-'));
  const scriptPath = path.join(tempDir, 'extract.py');
  const sourcePath = path.join(tempDir, 'submission.py');

  try {
    fs.writeFileSync(scriptPath, PYTHON_AST_EXTRACTOR, 'utf8');
    fs.writeFileSync(sourcePath, sourceCode, 'utf8');

    const result = spawnSync(python, [scriptPath, sourcePath], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (result.status !== 0) {
      const details = result.stderr.trim() || result.stdout.trim() || 'unknown extraction failure';
      throw new Error(`Python submission extraction failed: ${details}`);
    }

    return JSON.parse(result.stdout) as readonly ExtractedBlock[];
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function collectReachableNames(
  entrypointName: string,
  functionBlocks: readonly Extract<ExtractedBlock, { kind: 'function' }>[],
  constantBlocks: readonly Extract<ExtractedBlock, { kind: 'constant' }>[]
): {
  includedFunctions: ReadonlySet<string>;
  includedConstants: ReadonlySet<string>;
  referencedImportNames: ReadonlySet<string>;
} {
  const functionNames = new Set(functionBlocks.map((block) => block.name));
  const constantNames = new Set(constantBlocks.map((block) => block.name));
  const functionByName = new Map(functionBlocks.map((block) => [block.name, block]));
  const constantByName = new Map(constantBlocks.map((block) => [block.name, block]));

  const includedFunctions = new Set<string>();
  const includedConstants = new Set<string>();
  const referencedImportNames = new Set<string>();
  const functionQueue = [entrypointName];
  const constantQueue: string[] = [];

  while (functionQueue.length > 0) {
    const name = functionQueue.pop() ?? '';
    if (includedFunctions.has(name)) {
      continue;
    }

    includedFunctions.add(name);
    const block = functionByName.get(name);
    if (!block) {
      continue;
    }

    for (const reference of block.references) {
      if (functionNames.has(reference) && !includedFunctions.has(reference)) {
        functionQueue.push(reference);
        continue;
      }

      if (constantNames.has(reference) && !includedConstants.has(reference)) {
        constantQueue.push(reference);
        continue;
      }

      referencedImportNames.add(reference);
    }
  }

  while (constantQueue.length > 0) {
    const name = constantQueue.pop() ?? '';
    if (includedConstants.has(name)) {
      continue;
    }

    includedConstants.add(name);
    const block = constantByName.get(name);
    if (!block) {
      continue;
    }

    for (const reference of block.references) {
      if (functionNames.has(reference) && !includedFunctions.has(reference)) {
        functionQueue.push(reference);
        continue;
      }

      if (constantNames.has(reference) && !includedConstants.has(reference)) {
        constantQueue.push(reference);
        continue;
      }

      referencedImportNames.add(reference);
    }
  }

  return {
    includedFunctions,
    includedConstants,
    referencedImportNames
  };
}

export function extractPythonSubmission(request: ExtractPythonSubmissionRequest): ExtractPythonSubmissionResult {
  const sourceCode = request.sourceCode.trim();
  if (!sourceCode) {
    throw new Error('Source code is required');
  }

  const configuredEntrypoint = request.entryFunction.trim();
  if (!configuredEntrypoint) {
    throw new Error('entryFunction is required');
  }

  const blocks = parseTopLevelBlocks(sourceCode);
  const functionBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'function' }> => block.kind === 'function'
  );
  const constantBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'constant' }> => block.kind === 'constant'
  );
  const importBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'import' }> => block.kind === 'import'
  );

  const functionNames = new Set(functionBlocks.map((block) => block.name));
  const selectedEntrypoint = configuredEntrypoint;
  if (!functionNames.has(selectedEntrypoint)) {
    throw new Error(
      `Python submission must define a top-level ${selectedEntrypoint}() function`
    );
  }

  const {
    includedFunctions,
    includedConstants,
    referencedImportNames
  } = collectReachableNames(selectedEntrypoint, functionBlocks, constantBlocks);

  const includedBlocks = blocks.filter((block) => {
    if (block.kind === 'function') {
      return includedFunctions.has(block.name);
    }

    if (block.kind === 'constant') {
      return includedConstants.has(block.name);
    }

    if (block.kind === 'import') {
      if (block.isFutureImport) {
        return true;
      }
      if (block.hasWildcard) {
        return true;
      }
      return block.introducedNames.some((name) => referencedImportNames.has(name));
    }

    return false;
  });

  const extractedSourceCode = includedBlocks
    .sort((left, right) => left.start - right.start)
    .map((block) => block.code.trimEnd())
    .join('\n\n')
    .trim();

  if (!extractedSourceCode) {
    throw new Error(`Python submission extraction produced no runnable code for ${selectedEntrypoint}()`);
  }

  return {
    selectedEntrypoint,
    extractedSourceCode: `${extractedSourceCode}\n`
  };
}
