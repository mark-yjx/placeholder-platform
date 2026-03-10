import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { SettingsPage } from '../pages/SettingsPage';

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('settings page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-admin-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('enrolls TOTP for the current admin session', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            secret: 'ABCDEF123456',
            otpauthUri:
              'otpauth://totp/Placeholder%20Admin:admin@example.com?secret=ABCDEF123456',
            issuer: 'Placeholder Admin',
            accountName: 'admin@example.com'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'authenticated_admin',
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
      );

    renderSettingsPage();

    fireEvent.click(screen.getByRole('button', { name: 'Enable TOTP' }));

    await waitFor(() => {
      expect(screen.getByText('ABCDEF123456')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('First Authenticator Code'), {
      target: { value: '123456' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm TOTP' }));

    await waitFor(() => {
      expect(screen.getByText('TOTP is now enabled for this admin account.')).toBeTruthy();
    });
  });
});
