import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { SubmissionsListPage } from '../pages/SubmissionsListPage';

function renderSubmissionsPage() {
  return render(
    <MemoryRouter>
      <AuthProvider
        initialSession={{
          status: 'authenticated',
          user: { email: 'admin@example.com', role: 'admin' }
        }}
      >
        <SubmissionsListPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('submissions list page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a loading state while the submissions request is pending', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}) as never);

    renderSubmissionsPage();

    expect(screen.getByText('Loading submissions...')).toBeTruthy();
  });

  it('renders fetched submission rows and refreshes the list', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              submissionId: 'sub-101',
              ownerUserId: 'student-1',
              problemId: 'collapse',
              status: 'finished',
              verdict: 'WA',
              timeMs: 12,
              memoryKb: null,
              submittedAt: '2026-03-09T13:00:00Z'
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
              submissionId: 'sub-102',
              ownerUserId: 'student-2',
              problemId: 'collapse',
              status: 'running',
              verdict: null,
              timeMs: null,
              memoryKb: null,
              submittedAt: '2026-03-09T13:05:00Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderSubmissionsPage();

    await waitFor(() => {
      expect(screen.getByText('sub-101')).toBeTruthy();
    });

    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByText('sub-102')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when no submissions exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    renderSubmissionsPage();

    await waitFor(() => {
      expect(screen.getByText('No submissions are available yet.')).toBeTruthy();
    });
  });

  it('renders an error state when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Admin submissions are down.'));

    renderSubmissionsPage();

    await waitFor(() => {
      expect(screen.getByText('Admin submissions are down.')).toBeTruthy();
    });
  });
});
