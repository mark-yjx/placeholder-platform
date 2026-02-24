import { validateProblemPayload } from '@packages/domain/src/problem';

type ProblemRequestPayload = {
  title?: string;
  statement?: string;
  metadata?: {
    difficulty?: string;
    language?: string;
  };
};

export class ProblemRequestValidationError extends Error {
  constructor(public readonly issues: readonly { code: string; message: string }[]) {
    super(
      `Validation failed: ${issues.map((issue) => issue.code).join(',') || 'unknown_validation_error'}`
    );
  }
}

export function validateCreateProblemRequest(payload: ProblemRequestPayload): void {
  const issues = validateProblemPayload(payload);
  if (issues.length > 0) {
    throw new ProblemRequestValidationError(issues);
  }
}

export function validateUpdateProblemRequest(payload: ProblemRequestPayload): void {
  const issues = validateProblemPayload(payload);
  if (issues.length > 0) {
    throw new ProblemRequestValidationError(issues);
  }
}
