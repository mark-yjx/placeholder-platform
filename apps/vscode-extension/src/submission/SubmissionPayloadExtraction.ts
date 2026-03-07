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
      kind: 'function';
      start: number;
      code: string;
      name: string;
      references: readonly string[];
    }
  | {
      kind: 'constant';
      start: number;
      code: string;
      introducedNames: readonly string[];
      references: readonly string[];
    }
  | {
      kind: 'ignored';
      start: number;
      code: string;
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
    if segment is None:
        start = max(getattr(node, "lineno", 1) - 1, 0)
        end = max(getattr(node, "end_lineno", getattr(node, "lineno", 1)), 1)
        segment = "\n".join(lines[start:end])
    return segment.rstrip() + "\n"

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

def collect_assigned_names(node):
    names = []
    targets = []
    if isinstance(node, ast.Assign):
        targets = node.targets
    elif isinstance(node, ast.AnnAssign):
        targets = [node.target]
    else:
        return names

    for target in targets:
        if isinstance(target, ast.Name):
            names.append(target.id)
        elif isinstance(target, ast.Tuple):
            for element in target.elts:
                if isinstance(element, ast.Name):
                    names.append(element.id)
    return sorted(set(names))

def strip_leading_docstring(node, source_text):
    body = getattr(node, "body", [])
    if not body:
        return source_text
    first = body[0]
    if not (
        isinstance(first, ast.Expr)
        and isinstance(getattr(first, "value", None), ast.Constant)
        and isinstance(first.value.value, str)
    ):
        return source_text

    if not hasattr(first, "lineno") or not hasattr(first, "end_lineno"):
        return source_text

    lines = source_text.splitlines()
    if len(lines) < 2 or not hasattr(node, "lineno"):
        return source_text

    doc_start = first.lineno - node.lineno
    doc_end = first.end_lineno - node.lineno
    if doc_start < 1 or doc_end < doc_start or doc_end >= len(lines):
        return source_text

    rebuilt = [lines[0]]
    rebuilt.extend(lines[1:doc_start])
    rebuilt.extend(lines[doc_end + 1 :])
    return "\n".join(rebuilt).rstrip() + "\n"

blocks = []
for node in module.body:
    start = getattr(node, "lineno", 1) - 1
    code = slice_source(node)

    if isinstance(node, ast.Import):
        introduced = []
        for alias in node.names:
            introduced.append(alias.asname or alias.name.split(".", 1)[0])
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
        blocks.append({
            "kind": "function",
            "start": start,
            "code": strip_leading_docstring(node, code),
            "name": node.name,
            "references": [name for name in collect_references(node) if name != node.name],
        })
        continue

    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        introduced_names = collect_assigned_names(node)
        if introduced_names:
            references = collect_references(node)
            references = [name for name in references if name not in introduced_names]
            blocks.append({
                "kind": "constant",
                "start": start,
                "code": code,
                "introducedNames": introduced_names,
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
    throw new Error('Python interpreter unavailable for submission extraction');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-extension-submit-'));
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

export function extractSubmitPayload(sourceCode: string): string {
  const trimmed = sourceCode.trim();
  if (!trimmed) {
    throw new Error('Source code is required');
  }

  const blocks = parseTopLevelBlocks(trimmed);
  const functionBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'function' }> => block.kind === 'function'
  );
  const importBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'import' }> => block.kind === 'import'
  );
  const constantBlocks = blocks.filter(
    (block): block is Extract<ExtractedBlock, { kind: 'constant' }> => block.kind === 'constant'
  );

  const solveBlock = functionBlocks.find((block) => block.name === 'solve');
  if (!solveBlock) {
    throw new Error('Submission must define a top-level solve() function');
  }

  const includedFunctions = new Set<string>();
  const includedConstantStarts = new Set<number>();
  const referencedImports = new Set<string>();
  const functionByName = new Map(functionBlocks.map((block) => [block.name, block]));
  const constantByName = new Map<string, Extract<ExtractedBlock, { kind: 'constant' }>>();
  for (const block of constantBlocks) {
    for (const name of block.introducedNames) {
      constantByName.set(name, block);
    }
  }
  const functionQueue = ['solve'];
  const constantQueue: string[] = [];

  const processReference = (reference: string): void => {
    if (functionByName.has(reference)) {
      if (!includedFunctions.has(reference)) {
        functionQueue.push(reference);
      }
      return;
    }
    const constantBlock = constantByName.get(reference);
    if (constantBlock) {
      if (!includedConstantStarts.has(constantBlock.start)) {
        constantQueue.push(reference);
      }
      return;
    }
    referencedImports.add(reference);
  };

  while (functionQueue.length > 0 || constantQueue.length > 0) {
    if (functionQueue.length > 0) {
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
        processReference(reference);
      }
      continue;
    }

    const constantName = constantQueue.pop() ?? '';
    const constantBlock = constantByName.get(constantName);
    if (!constantBlock || includedConstantStarts.has(constantBlock.start)) {
      continue;
    }

    includedConstantStarts.add(constantBlock.start);
    for (const reference of constantBlock.references) {
      if (!constantBlock.introducedNames.includes(reference)) {
        processReference(reference);
      }
    }
  }

  const includedBlocks = blocks.filter((block) => {
    if (block.kind === 'function') {
      return includedFunctions.has(block.name);
    }

    if (block.kind === 'import') {
      if (block.isFutureImport || block.hasWildcard) {
        return true;
      }
      return block.introducedNames.some((name) => referencedImports.has(name));
    }

    if (block.kind === 'constant') {
      return includedConstantStarts.has(block.start);
    }

    return false;
  });

  const extractedSourceCode = includedBlocks
    .sort((left, right) => left.start - right.start)
    .map((block) => block.code.trimEnd())
    .join('\n\n')
    .trim();

  if (!extractedSourceCode) {
    throw new Error('Submission extraction produced no runnable solve() payload');
  }

  return `${extractedSourceCode}\n`;
}
