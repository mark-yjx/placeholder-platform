import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OJ_API_BASE_URL,
  DEFAULT_OJ_REQUEST_TIMEOUT_MS,
  describeTokenStorageBehavior,
  resolveApiBaseUrl,
  resolveRequestTimeoutMs,
  validateApiBaseUrl,
  WorkspaceConfigurationLike
} from '../config/ExtensionConfiguration';

class FakeWorkspaceConfiguration implements WorkspaceConfigurationLike {
  constructor(private readonly values: Record<string, unknown>) {}

  get<T>(section: string, defaultValue: T): T {
    return (this.values[section] ?? defaultValue) as T;
  }
}

test('api base url resolves from oj.apiBaseUrl setting and trims trailing slash', () => {
  const configuration = new FakeWorkspaceConfiguration({
    apiBaseUrl: 'https://oj.example.test/api/'
  });

  assert.equal(resolveApiBaseUrl(configuration), 'https://oj.example.test/api');
});

test('api base url falls back to default when setting is empty', () => {
  const configuration = new FakeWorkspaceConfiguration({
    apiBaseUrl: '   '
  });

  assert.equal(resolveApiBaseUrl(configuration), DEFAULT_OJ_API_BASE_URL);
});

test('api base url validation rejects unsupported protocols', () => {
  assert.throws(
    () => validateApiBaseUrl('ftp://oj.example.test'),
    /Set oj\.apiBaseUrl to a valid http:\/\/ or https:\/\/ URL/
  );
});

test('request timeout resolves from oj.requestTimeoutMs and validates positive values', () => {
  const configuration = new FakeWorkspaceConfiguration({
    requestTimeoutMs: 2500 as unknown as string
  });

  assert.equal(resolveRequestTimeoutMs(configuration), 2500);
  assert.throws(
    () =>
      resolveRequestTimeoutMs(
        new FakeWorkspaceConfiguration({
          requestTimeoutMs: 0 as unknown as string
        })
      ),
    /Set oj\.requestTimeoutMs to a positive number of milliseconds/
  );
  assert.equal(
    resolveRequestTimeoutMs(new FakeWorkspaceConfiguration({})),
    DEFAULT_OJ_REQUEST_TIMEOUT_MS
  );
});

test('token storage behavior description is explicit', () => {
  assert.equal(
    describeTokenStorageBehavior(),
    'Auth tokens are stored in VS Code SecretStorage on this machine.'
  );
});
