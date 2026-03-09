import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractSubmitPayload } from '../submission/SubmissionPayloadExtraction';
import { PublicProblemTestCase } from '../api/PracticeApiClient';

export type LocalPublicTestFailure = {
  caseIndex: number;
  input: unknown;
  expected: unknown;
  actual?: unknown;
  error?: string;
};

export type LocalPublicTestRunResult = {
  total: number;
  failures: readonly LocalPublicTestFailure[];
};

const PUBLIC_TEST_RUNNER = String.raw`
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    source = handle.read()
with open(sys.argv[2], "r", encoding="utf-8") as handle:
    tests = json.load(handle)

entry_function = sys.argv[3]
namespace = {}

def normalize(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, tuple):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {str(key): normalize(item) for key, item in value.items()}
    return repr(value)

try:
    exec(compile(source, sys.argv[1], "exec"), namespace)
except Exception as exc:
    print(json.dumps({
        "total": len(tests),
        "failures": [{
            "caseIndex": 0,
            "input": None,
            "expected": None,
            "error": f"{exc.__class__.__name__}: {exc}"
        }]
    }))
    raise SystemExit(0)

selected = namespace.get(entry_function)
if not callable(selected):
    print(json.dumps({
        "total": len(tests),
        "failures": [{
            "caseIndex": 0,
            "input": None,
            "expected": None,
            "error": f"Missing callable {entry_function}"
        }]
    }))
    raise SystemExit(0)

failures = []
for index, case in enumerate(tests, start=1):
    try:
        actual = selected(case["input"])
    except Exception as exc:
        failures.append({
            "caseIndex": index,
            "input": normalize(case["input"]),
            "expected": normalize(case["output"]),
            "error": f"{exc.__class__.__name__}: {exc}"
        })
        continue

    if actual != case["output"]:
        failures.append({
            "caseIndex": index,
            "input": normalize(case["input"]),
            "expected": normalize(case["output"]),
            "actual": normalize(actual)
        })

print(json.dumps({
    "total": len(tests),
    "failures": failures
}))
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

export function runLocalPublicTests(
  sourceCode: string,
  entryFunction: string,
  publicTests: readonly PublicProblemTestCase[]
): LocalPublicTestRunResult {
  if (publicTests.length === 0) {
    return {
      total: 0,
      failures: []
    };
  }

  const python = resolvePythonCommand();
  if (!python) {
    throw new Error('Python interpreter unavailable for local public test execution');
  }

  const extractedSourceCode = extractSubmitPayload(sourceCode, entryFunction);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-public-tests-'));
  const runnerPath = path.join(tempDir, 'run_public_tests.py');
  const sourcePath = path.join(tempDir, 'submission.py');
  const testsPath = path.join(tempDir, 'public_tests.json');

  try {
    fs.writeFileSync(runnerPath, PUBLIC_TEST_RUNNER, 'utf8');
    fs.writeFileSync(sourcePath, extractedSourceCode, 'utf8');
    fs.writeFileSync(testsPath, JSON.stringify(publicTests), 'utf8');

    const result = spawnSync(python, [runnerPath, sourcePath, testsPath, entryFunction], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (result.status !== 0) {
      const details = result.stderr.trim() || result.stdout.trim() || 'unknown public test failure';
      throw new Error(`Local public test execution failed: ${details}`);
    }

    return JSON.parse(result.stdout) as LocalPublicTestRunResult;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
