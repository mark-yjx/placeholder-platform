import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { SubmissionDetailPage } from '../pages/SubmissionDetailPage';

function renderSubmissionDetailPage() {
  return render(
    <MemoryRouter initialEntries={['/submissions/sub-101']}>
      <AuthProvider
        initialSession={{
          status: 'authenticated',
          user: { email: 'admin@example.com', role: 'admin' }
        }}
      >
        <Routes>
          <Route path="/submissions/:submissionId" element={<SubmissionDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('submission detail page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a loading state while the detail request is pending', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}) as never);

    renderSubmissionDetailPage();

    expect(screen.getByText('Loading submission details...')).toBeTruthy();
  });

  it('renders a selected submission with N/A metrics and no fake failure text', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          submissionId: 'sub-101',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          status: 'finished',
          verdict: 'WA',
          timeMs: 12,
          memoryKb: null,
          failureReason: null,
          errorDetail: null,
          submittedAt: '2026-03-09T13:00:00Z',
          sourceSnapshot: 'def collapse(number):\n    return 0\n'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderSubmissionDetailPage();

    await waitFor(() => {
      expect(screen.getByText('sub-101')).toBeTruthy();
    });

    expect(screen.getByText('WA')).toBeTruthy();
    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
    expect(screen.queryByText('Failure / Error')).toBeNull();
    expect(screen.queryByText('Failure Info: None')).toBeNull();
  });

  it('renders failure details when they truly exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          submissionId: 'sub-101',
          ownerUserId: 'student-1',
          problemId: 'collapse',
          status: 'failed',
          verdict: null,
          timeMs: null,
          memoryKb: null,
          failureReason: 'Worker crashed before judging.',
          errorDetail: null,
          submittedAt: '2026-03-09T13:00:00Z',
          sourceSnapshot: 'def collapse(number):\n    raise RuntimeError(\"boom\")\n'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderSubmissionDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Failure / Error')).toBeTruthy();
    });

    expect(screen.getByText('Worker crashed before judging.')).toBeTruthy();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });

  it('renders an error state when the detail request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Submission detail is unavailable.'));

    renderSubmissionDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Submission detail is unavailable.')).toBeTruthy();
    });
  });
});
