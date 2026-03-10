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

  it('renders analytics overview cards, problem stats, and charts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              submissionId: 'sub-101',
              ownerUserId: 'student-1',
              problemId: 'collapse',
              status: 'finished',
              verdict: 'AC',
              timeMs: 12,
              memoryKb: 256,
              submittedAt: '2026-03-09T10:00:00.000Z'
            },
            {
              submissionId: 'sub-102',
              ownerUserId: 'student-2',
              problemId: 'collapse',
              status: 'finished',
              verdict: 'AC',
              timeMs: 16,
              memoryKb: 300,
              submittedAt: '2026-03-10T10:00:00.000Z'
            },
            {
              submissionId: 'sub-103',
              ownerUserId: 'student-2',
              problemId: 'arrays-101',
              status: 'finished',
              verdict: 'WA',
              timeMs: 22,
              memoryKb: 320,
              submittedAt: '2026-03-10T12:00:00.000Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              problemId: 'collapse',
              title: 'Collapse Digits',
              visibility: 'published',
              updatedAt: '2026-03-01T00:00:00.000Z'
            },
            {
              problemId: 'arrays-101',
              title: 'Array Warmup',
              visibility: 'published',
              updatedAt: '2026-03-02T00:00:00.000Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Analytics Overview' })).toBeTruthy();
    });

    expect(screen.getByRole('heading', { name: '42' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '140' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '76' })).toBeTruthy();
    expect(screen.getByText('Most solved problems')).toBeTruthy();
    expect(screen.getByText('Least solved problems')).toBeTruthy();
    expect(screen.getAllByText('Collapse Digits').length).toBeGreaterThan(0);
    expect(screen.getByText('Submission volume')).toBeTruthy();
    expect(screen.getAllByText('Active users').length).toBeGreaterThan(0);
    expect(screen.getByText('Language usage')).toBeTruthy();
    expect(screen.getByText('Difficulty completion')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8200/admin/analytics/overview', {
      headers: {
        authorization: 'Bearer signed-token'
      }
    });
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8200/admin/submissions', {
      headers: {
        authorization: 'Bearer signed-token'
      }
    });
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8200/admin/problems', {
      headers: {
        authorization: 'Bearer signed-token'
      }
    });
  });
});
