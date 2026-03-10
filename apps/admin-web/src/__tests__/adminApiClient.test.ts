import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAdminApi,
  resolveAdminApiBaseUrl,
  resolveAdminApiTimeoutMs
} from '../api/client';

describe('admin api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the loopback default for local browser locations', () => {
    expect(resolveAdminApiBaseUrl({ protocol: 'http:', hostname: 'localhost' })).toBe(
      'http://127.0.0.1:8200'
    );
    expect(resolveAdminApiBaseUrl({ protocol: 'http:', hostname: '127.0.0.1' })).toBe(
      'http://127.0.0.1:8200'
    );
  });

  it('derives the admin api host from forwarded browser locations', () => {
    expect(
      resolveAdminApiBaseUrl({
        protocol: 'https:',
        hostname: '5173-mark-t14s.preview.app.github.dev'
      })
    ).toBe('https://8200-mark-t14s.preview.app.github.dev');
    expect(
      resolveAdminApiBaseUrl({
        protocol: 'https:',
        hostname: 'mark-t14s-5173.githubpreview.dev'
      })
    ).toBe('https://mark-t14s-8200.githubpreview.dev');
  });

  it('falls back to the default timeout when the env value is invalid', () => {
    expect(resolveAdminApiTimeoutMs(undefined)).toBe(8000);
    expect(resolveAdminApiTimeoutMs('bad')).toBe(8000);
    expect(resolveAdminApiTimeoutMs('0')).toBe(8000);
  });

  it('times out with a clear admin api error', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }) as Promise<Response>;
    });

    const request = fetchAdminApi('/admin/auth/login', { method: 'POST' });
    const expectation = expect(request).rejects.toThrow(
      'Admin API request timed out after 8000ms. Verify the Admin API server and VITE_ADMIN_API_BASE_URL.'
    );

    await vi.advanceTimersByTimeAsync(8000);

    await expectation;
  });
});
