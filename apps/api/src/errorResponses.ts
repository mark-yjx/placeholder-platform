export type ApiErrorDetail = {
  field: string;
  code: string;
  message: string;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: readonly ApiErrorDetail[];
  };
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: readonly ApiErrorDetail[]
  ) {
    super(message);
  }
}

export function createErrorPayload(error: ApiError): ApiErrorPayload {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    }
  };
}

export function createValidationError(
  message: string,
  details: readonly ApiErrorDetail[]
): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}

export function mapUnknownError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return createValidationError('invalid json payload', [
      {
        field: 'body',
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON.'
      }
    ]);
  }

  if (error instanceof Error) {
    if (error.message === 'Forbidden') {
      return new ApiError(403, 'FORBIDDEN', 'Forbidden');
    }
    if (error.message === 'Problem not found') {
      return new ApiError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
    }
    if (process.env.NODE_ENV === 'production') {
      return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal Server Error');
    }
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', error.message);
  }

  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal Server Error');
}
