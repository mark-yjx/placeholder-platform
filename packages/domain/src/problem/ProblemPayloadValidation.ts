export type ProblemValidationIssue = {
  code: string;
  message: string;
};

export type ProblemPayload = {
  title?: string;
  statement?: string;
  metadata?: {
    difficulty?: string;
    language?: string;
  };
};

export function validateProblemPayload(payload: ProblemPayload): readonly ProblemValidationIssue[] {
  const issues: ProblemValidationIssue[] = [];

  if (!payload.title || payload.title.trim().length === 0) {
    issues.push({ code: 'title_required', message: 'Title is required' });
  }
  if (!payload.statement || payload.statement.trim().length === 0) {
    issues.push({ code: 'statement_required', message: 'Statement is required' });
  }
  if (!payload.metadata) {
    issues.push({ code: 'metadata_required', message: 'Metadata is required' });
    return issues;
  }
  if (!payload.metadata.difficulty || payload.metadata.difficulty.trim().length === 0) {
    issues.push({ code: 'difficulty_required', message: 'Difficulty is required' });
  }
  if (!payload.metadata.language || payload.metadata.language.trim().length === 0) {
    issues.push({ code: 'language_required', message: 'Language is required' });
    return issues;
  }
  if (payload.metadata.language.toLowerCase() !== 'python') {
    issues.push({
      code: 'language_unsupported',
      message: 'Only python language is supported for MVP'
    });
  }

  return issues;
}
