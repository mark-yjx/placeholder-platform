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
  });

  it('renders the login form', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  });

  it('stores the token and navigates after a successful login', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: 'signed-token',
          user: { email: 'admin@example.com', role: 'admin' }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'admin@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct horse' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeTruthy();
    });

    expect(window.localStorage.getItem('oj.admin.token')).toBe('signed-token');
    expect(screen.getByText('Signed in as admin@example.com.')).toBeTruthy();
  });

  it('redirects protected routes to login when no token is available', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeTruthy();
    });
  });
});
