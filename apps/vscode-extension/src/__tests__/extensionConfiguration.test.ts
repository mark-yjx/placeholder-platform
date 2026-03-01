import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OJ_API_BASE_URL,
  resolveApiBaseUrl,
  WorkspaceConfigurationLike
} from '../config/ExtensionConfiguration';

class FakeWorkspaceConfiguration implements WorkspaceConfigurationLike {
  constructor(private readonly values: Record<string, string | undefined>) {}

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
