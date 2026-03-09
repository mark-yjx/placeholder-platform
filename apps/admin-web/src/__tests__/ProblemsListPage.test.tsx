import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { ProblemsListPage } from '../pages/ProblemsListPage';

function renderProblemsPage() {
  return render(
    <MemoryRouter>
      <AuthProvider
        initialSession={{
          status: 'authenticated',
          user: { email: 'admin@example.com', role: 'admin' }
        }}
      >
        <ProblemsListPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('problems list page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a loading state while the list request is pending', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}) as never);

    renderProblemsPage();

    expect(screen.getByText('Loading problems...')).toBeTruthy();
  });

  it('renders fetched problem rows and refreshes the list', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              problemId: 'collapse',
              title: 'Collapse Identical Digits',
              visibility: 'public',
              updatedAt: '2026-03-09T12:00:00Z'
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
              problemId: 'two-sum',
              title: 'Two Sum',
              visibility: 'private',
              updatedAt: '2026-03-10T09:30:00Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderProblemsPage();

    await waitFor(() => {
      expect(screen.getByText('Collapse Identical Digits')).toBeTruthy();
    });
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when no problems exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    renderProblemsPage();

    await waitFor(() => {
      expect(screen.getByText('No problems are available yet.')).toBeTruthy();
    });
  });

  it('renders an error state when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network down.'));

    renderProblemsPage();

    await waitFor(() => {
      expect(screen.getByText('Network down.')).toBeTruthy();
    });
  });
});
