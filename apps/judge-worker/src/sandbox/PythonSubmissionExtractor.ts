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
  entryFunction = 'solve'
): string {
  const extracted = extractPythonSubmission({
    sourceCode,
    entryFunction
  });

  return `${extracted.extractedSourceCode.trimEnd()}

if __name__ == "__main__":
    __oj_result = ${extracted.selectedEntrypoint}()
    if __oj_result is not None:
        print(__oj_result)
`;
}
