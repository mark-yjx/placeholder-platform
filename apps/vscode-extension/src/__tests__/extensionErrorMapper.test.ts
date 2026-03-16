import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StudentOnlyExtensionError,
  STUDENT_ONLY_EXTENSION_MESSAGE
} from '../auth/AuthCommands';
import {
  ExtensionApiError,
  mapExtensionError
} from '../errors/ExtensionErrorMapper';

test('network failures show a user-friendly API unreachable message', () => {
  const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), {
    code: 'ECONNREFUSED'
  });

  assert.deepEqual(mapExtensionError(error), {
    userMessage: 'Unable to reach the Placeholder student API. Check that the server is running and verify oj.apiBaseUrl, then try again.',
    logMessage: 'Network error ECONNREFUSED'
  });
});

test('network failures include the target request when available', () => {
  const error = Object.assign(new Error('fetch failed'), {
    code: 'ECONNREFUSED',
    requestMethod: 'POST',
    requestUrl: 'http://127.0.0.1:3100/auth/extension/exchange'
  });

  assert.deepEqual(mapExtensionError(error), {
    userMessage:
      'Unable to reach the Placeholder student API at http://127.0.0.1:3100/auth/extension/exchange. Check that the server is running and verify oj.apiBaseUrl, then try again.',
    logMessage:
      'Network error ECONNREFUSED while requesting POST http://127.0.0.1:3100/auth/extension/exchange'
  });
});

test('401 errors prompt the user to sign in', () => {
  assert.deepEqual(
    mapExtensionError(
      new ExtensionApiError(401, {
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Authentication token is invalid' }
      })
    ),
    {
      userMessage: 'Please sign in to continue. Run Placeholder Practice: Sign In and try again.',
      logMessage: 'API 401 AUTH_INVALID_TOKEN'
    }
  );
});

test('invalid credential errors show a login-specific message', () => {
  assert.deepEqual(
    mapExtensionError(
      new ExtensionApiError(401, {
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'invalid credentials' }
      })
    ),
    {
      userMessage: 'Invalid email or password. Run Placeholder Practice: Sign In and try again.',
      logMessage: 'API 401 AUTH_INVALID_CREDENTIALS'
    }
  );
});

test('403 errors show a permission message', () => {
  assert.deepEqual(
    mapExtensionError(
      new ExtensionApiError(403, {
        error: { code: 'FORBIDDEN', message: 'Forbidden' }
      })
    ),
    {
      userMessage: 'You do not have permission to perform this action. Use an allowed account and try again.',
      logMessage: 'API 403 FORBIDDEN'
    }
  );
});

test('404 errors show a readable resource message', () => {
  assert.deepEqual(
    mapExtensionError(
      new ExtensionApiError(404, {
        error: { code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found' }
      })
    ),
    {
      userMessage: 'Submission not found',
      logMessage: 'API 404 SUBMISSION_NOT_FOUND'
    }
  );
});

test('unexpected failures hide raw stack traces from the user', () => {
  const mapped = mapExtensionError(
    new Error('Error: boom\n    at extension.ts:10:2\n    at runner:1:1')
  );

  assert.equal(mapped.userMessage, 'Something went wrong. Check the Placeholder Practice output channel for details, then try again.');
  assert.match(mapped.logMessage, /boom/);
});

test('admin-role login rejection surfaces the student-only boundary message', () => {
  assert.deepEqual(mapExtensionError(new StudentOnlyExtensionError()), {
    userMessage: STUDENT_ONLY_EXTENSION_MESSAGE,
    logMessage: STUDENT_ONLY_EXTENSION_MESSAGE
  });
});
