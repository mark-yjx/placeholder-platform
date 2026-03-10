import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('dashboard page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders analytics overview cards', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalUsers: 42,
          activeUsers: 11,
          activeWindowDays: 30,
          totalSubmissions: 140,
          totalAcceptedSubmissions: 76,
          uniqueProblemSolves: 29
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    });

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('140')).toBeTruthy();
    expect(screen.getByText('76')).toBeTruthy();
    expect(screen.getByText('29')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8200/admin/analytics/overview', {
      headers: {
        authorization: 'Bearer signed-token'
      }
    });
  });
});
