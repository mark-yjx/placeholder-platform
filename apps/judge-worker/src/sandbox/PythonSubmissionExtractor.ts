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

  const invocation =
    testInputJson === undefined
      ? `${extracted.selectedEntrypoint}()`
      : [
          'import json',
          `__oj_input = json.loads(${JSON.stringify(testInputJson)})`,
          `__oj_result = ${extracted.selectedEntrypoint}(__oj_input)`,
          'print(json.dumps(__oj_result))'
        ].join('\n');

  return `${extracted.extractedSourceCode.trimEnd()}

if __name__ == "__main__":
    ${invocation.split('\n').join('\n    ')}
`;
}
