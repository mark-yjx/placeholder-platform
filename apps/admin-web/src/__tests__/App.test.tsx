import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { AppRoutes } from '../routes/AppRoutes';

function renderApp(initialEntry: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('admin auth flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders the Microsoft sign-in page', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in with Microsoft' })).toBeTruthy();
  });

  it('renders the Microsoft login link', () => {
    renderApp('/login');

    expect(
      screen.getByRole('link', { name: 'Sign in with Microsoft' }).getAttribute('href')
    ).toBe('http://127.0.0.1:8200/admin/auth/login/microsoft');
  });

  it('redirects protected routes to login when no session is available', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
    });
  });

  it('redirects pending TOTP sessions to the verification page', async () => {
    window.localStorage.setItem('oj.admin.token', 'pending-token');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          state: 'pending_tfa',
          user: {
            email: 'admin@example.com',
            userId: 'admin-1',
            role: 'admin',
            totpEnabled: true
          },
          pendingExpiresAt: '2026-03-10T10:05:00Z'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TOTP Verification' })).toBeTruthy();
    });
  });

  it('submits the TOTP page and upgrades the session', async () => {
    window.localStorage.setItem('oj.admin.token', 'pending-token');
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'pending_tfa',
            user: {
              email: 'admin@example.com',
              userId: 'admin-1',
              role: 'admin',
              totpEnabled: true
            },
            pendingExpiresAt: '2026-03-10T10:05:00Z'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'authenticated_admin',
            token: 'full-token',
            user: {
              email: 'admin@example.com',
              userId: 'admin-1',
              role: 'admin',
              totpEnabled: true
            },
            pendingExpiresAt: null
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    renderApp('/verify-totp');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TOTP Verification' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Authenticator Code'), {
      target: { value: '123456' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Problems' })).toBeTruthy();
    });

    expect(window.localStorage.getItem('oj.admin.token')).toBe('full-token');
  });

  it('allows authenticated admins to reach protected pages', async () => {
    window.localStorage.setItem('oj.admin.token', 'full-token');
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'authenticated_admin',
            user: {
              email: 'admin@example.com',
              userId: 'admin-1',
              role: 'admin',
              totpEnabled: false
            },
            pendingExpiresAt: null
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Problems' })).toBeTruthy();
    });
  });

  it('renders failure messages from the login page query string', () => {
    renderApp('/login?error=Microsoft%20login%20failed.');

    expect(screen.getByText('Microsoft login failed.')).toBeTruthy();
  });
});
