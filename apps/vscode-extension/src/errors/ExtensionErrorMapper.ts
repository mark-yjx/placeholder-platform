import { StudentOnlyExtensionError, STUDENT_ONLY_EXTENSION_MESSAGE } from '../auth/AuthCommands';

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ExtensionApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload?: ApiErrorPayload,
    message?: string
  ) {
    super(message ?? payload?.error?.message ?? `API request failed with status ${statusCode}`);
    this.name = 'ExtensionApiError';
  }
}

export type MappedExtensionError = {
  userMessage: string;
  logMessage: string;
};

function normalizeApiMessage(payload?: ApiErrorPayload): string | null {
  const message = payload?.error?.message?.trim();
  return message && message.length > 0 ? message : null;
}

export function mapExtensionError(error: unknown): MappedExtensionError {
  if (error instanceof StudentOnlyExtensionError) {
    return {
      userMessage: STUDENT_ONLY_EXTENSION_MESSAGE,
      logMessage: STUDENT_ONLY_EXTENSION_MESSAGE
    };
  }

  if (error instanceof ExtensionApiError) {
    const apiMessage = normalizeApiMessage(error.payload);

    if (error.statusCode === 401) {
      const errorCode = error.payload?.error?.code ?? 'UNAUTHORIZED';
      return {
        userMessage:
          errorCode === 'AUTH_INVALID_CREDENTIALS'
            ? 'Invalid email or password. Run Placeholder Practice: Sign In and try again.'
            : 'Please sign in to continue. Run Placeholder Practice: Sign In and try again.',
        logMessage: `API 401 ${errorCode}`
      };
    }

    if (error.statusCode === 403) {
      return {
        userMessage: 'You do not have permission to perform this action. Use an allowed account and try again.',
        logMessage: `API 403 ${error.payload?.error?.code ?? 'FORBIDDEN'}`
      };
    }

    if (error.statusCode === 404) {
      return {
        userMessage: apiMessage ?? 'Requested resource was not found. Refresh data and try again.',
        logMessage: `API 404 ${error.payload?.error?.code ?? 'NOT_FOUND'}`
      };
    }

    return {
      userMessage: apiMessage ?? 'The Placeholder Practice request failed. Check the Placeholder Practice output channel, then try again.',
      logMessage: `API ${error.statusCode} ${error.payload?.error?.code ?? 'UNKNOWN'}`
    };
  }

  const networkCode =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;

  const rawMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = rawMessage.toLowerCase();
  const requestMethod =
    typeof error === 'object' &&
    error !== null &&
    'requestMethod' in error &&
    typeof (error as { requestMethod?: unknown }).requestMethod === 'string'
      ? (error as { requestMethod: string }).requestMethod
      : null;
  const requestUrl =
    typeof error === 'object' &&
    error !== null &&
    'requestUrl' in error &&
    typeof (error as { requestUrl?: unknown }).requestUrl === 'string'
      ? (error as { requestUrl: string }).requestUrl
      : null;
  const requestTarget = requestUrl ? `${requestMethod ? `${requestMethod} ` : ''}${requestUrl}` : null;

  if (
    networkCode === 'ECONNREFUSED' ||
    networkCode === 'ENOTFOUND' ||
    networkCode === 'ETIMEDOUT' ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('socket hang up')
  ) {
    return {
      userMessage: requestUrl
        ? `Unable to reach the Placeholder student API at ${requestUrl}. Check that the server is running and verify oj.apiBaseUrl, then try again.`
        : 'Unable to reach the Placeholder student API. Check that the server is running and verify oj.apiBaseUrl, then try again.',
      logMessage: requestTarget
        ? `${networkCode ? `Network error ${networkCode}` : rawMessage} while requesting ${requestTarget}`
        : networkCode
          ? `Network error ${networkCode}`
          : rawMessage
    };
  }

  if (normalizedMessage.includes('authentication required')) {
    return {
      userMessage: 'Please sign in to continue. Run Placeholder Practice: Sign In and try again.',
      logMessage: rawMessage
    };
  }

  if (
    normalizedMessage.includes('problem statement is unavailable') ||
    normalizedMessage.includes('problem starter code is unavailable')
  ) {
    return {
      userMessage: rawMessage,
      logMessage: rawMessage
    };
  }

  return {
    userMessage: 'Something went wrong. Check the Placeholder Practice output channel for details, then try again.',
    logMessage: rawMessage
  };
}
