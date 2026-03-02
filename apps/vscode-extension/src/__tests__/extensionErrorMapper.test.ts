import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExtensionApiError,
  mapExtensionError
} from '../errors/ExtensionErrorMapper';

test('network failures show a user-friendly API unreachable message', () => {
  const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), {
    code: 'ECONNREFUSED'
  });

  assert.deepEqual(mapExtensionError(error), {
    userMessage: 'Unable to reach the OJ API. Check that the server is running and verify oj.apiBaseUrl, then try again.',
    logMessage: 'Network error ECONNREFUSED'
  });
});

test('401 errors prompt the user to login', () => {
  assert.deepEqual(
    mapExtensionError(
      new ExtensionApiError(401, {
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Authentication token is invalid' }
      })
    ),
    {
      userMessage: 'Please login to continue. Run OJ: Login and try again.',
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
      userMessage: 'Invalid email or password. Run OJ: Login and try again.',
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

  assert.equal(mapped.userMessage, 'Something went wrong. Check the OJ output channel for details, then try again.');
  assert.match(mapped.logMessage, /boom/);
});
