const { extractPythonSubmission } = require(
  '@packages/application/src/submission/PythonSubmissionExtraction.ts'
) as typeof import('@packages/application/src/submission/PythonSubmissionExtraction');

export function extractJudgedPythonSource(sourceCode: string, entryFunction = 'solve'): string {
  return extractPythonSubmission({
    sourceCode,
    entryFunction
  }).extractedSourceCode;
}

export function buildRunnableJudgedPythonSource(
  sourceCode: string,
  entryFunction = 'solve',
  testInputJson?: string
): string {
  const extracted = extractPythonSubmission({
    sourceCode,
    entryFunction
  });
  const moduleSource = [
    extracted.extractedSourceCode.trimEnd(),
    extracted.selectedEntrypoint === 'solve'
      ? ''
      : [
          '',
          'def solve(*args, **kwargs):',
          `    return ${extracted.selectedEntrypoint}(*args, **kwargs)`
        ].join('\n')
  ]
    .filter((segment) => segment.length > 0)
    .join('\n');

  const invocation =
    testInputJson === undefined
      ? '__oj_submission.solve()'
      : [
          'import json',
          `__oj_input = json.loads(${JSON.stringify(testInputJson)})`,
          '__oj_result = __oj_submission.solve(__oj_input)',
          'print(json.dumps(__oj_result))'
        ].join('\n');

  return [
    'import importlib.util',
    'import os',
    'import tempfile',
    '',
    `__oj_module_source = ${JSON.stringify(`${moduleSource}\n`)}`,
    '__oj_submission_path = ""',
    'try:',
    '    with tempfile.NamedTemporaryFile("w", suffix="_submission.py", delete=False) as __oj_submission_file:',
    '        __oj_submission_file.write(__oj_module_source)',
    '        __oj_submission_path = __oj_submission_file.name',
    '    __oj_spec = importlib.util.spec_from_file_location("oj_submission_module", __oj_submission_path)',
    '    if __oj_spec is None or __oj_spec.loader is None:',
    '        raise RuntimeError("unable to load submission module spec")',
    '    __oj_submission = importlib.util.module_from_spec(__oj_spec)',
    '    __oj_spec.loader.exec_module(__oj_submission)',
    `    ${invocation.split('\n').join('\n    ')}`,
    'finally:',
    '    if __oj_submission_path and os.path.exists(__oj_submission_path):',
    '        os.unlink(__oj_submission_path)',
    ''
  ].join('\n');
}
