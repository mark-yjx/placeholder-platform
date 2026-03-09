import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { UsersListPage } from '../pages/UsersListPage';

function renderUsersPage() {
  return render(
    <MemoryRouter>
      <AuthProvider
        initialSession={{
          status: 'authenticated',
          user: { email: 'admin@example.com', role: 'admin' }
        }}
      >
        <UsersListPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('users list page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders fetched platform users', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            userId: 'user-1',
            email: 'student1@example.com',
            displayName: 'Student One',
            role: 'student',
            status: 'active',
            createdAt: '2026-03-09T12:00:00Z'
          }
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('student1@example.com')).toBeTruthy();
    });

    expect(screen.getByText('Student One')).toBeTruthy();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Edit' })).toBeTruthy();
  });

  it('creates a user from the list page', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'user-new',
            email: 'new@example.com',
            displayName: 'New User',
            role: 'student',
            status: 'active',
            createdAt: '2026-03-10T09:00:00Z',
            updatedAt: '2026-03-10T09:00:00Z',
            lastLoginAt: null
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              userId: 'user-new',
              email: 'new@example.com',
              displayName: 'New User',
              role: 'student',
              status: 'active',
              createdAt: '2026-03-10T09:00:00Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('No platform users are available yet.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'New User' }
    });
    fireEvent.change(screen.getByLabelText('Initial Password'), {
      target: { value: 'correct horse battery' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/users',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });
});
