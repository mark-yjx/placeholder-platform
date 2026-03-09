import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { UserDetailPage } from '../pages/UserDetailPage';

function renderUserDetailPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users/user-101']}>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('user detail page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders and saves the selected user profile', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'user-101',
            email: 'student1@example.com',
            displayName: 'Student One',
            role: 'student',
            status: 'active',
            createdAt: '2026-03-09T12:00:00Z',
            updatedAt: '2026-03-09T12:00:00Z',
            lastLoginAt: null
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
            userId: 'user-101',
            email: 'student1@example.com',
            displayName: 'Updated Student',
            role: 'admin',
            status: 'disabled',
            createdAt: '2026-03-09T12:00:00Z',
            updatedAt: '2026-03-10T10:00:00Z',
            lastLoginAt: null
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderUserDetailPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Student One')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Updated Student' }
    });
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'disabled' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(screen.getByText('User profile saved.')).toBeTruthy();
    });
  });

  it('sets a replacement password and enables the user', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'user-101',
            email: 'student1@example.com',
            displayName: 'Student One',
            role: 'student',
            status: 'disabled',
            createdAt: '2026-03-09T12:00:00Z',
            updatedAt: '2026-03-09T12:00:00Z',
            lastLoginAt: null
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
            userId: 'user-101',
            email: 'student1@example.com',
            displayName: 'Student One',
            role: 'student',
            status: 'disabled',
            createdAt: '2026-03-09T12:00:00Z',
            updatedAt: '2026-03-10T10:00:00Z',
            lastLoginAt: null
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
            userId: 'user-101',
            email: 'student1@example.com',
            displayName: 'Student One',
            role: 'student',
            status: 'active',
            createdAt: '2026-03-09T12:00:00Z',
            updatedAt: '2026-03-10T10:01:00Z',
            lastLoginAt: null
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderUserDetailPage();

    await waitFor(() => {
      expect(screen.getAllByText('disabled').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'better horse battery' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }));

    await waitFor(() => {
      expect(screen.getByText('Password updated.')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Enable User' })[0]);

    await waitFor(() => {
      expect(screen.getByText('User enabled.')).toBeTruthy();
    });
  });
});
