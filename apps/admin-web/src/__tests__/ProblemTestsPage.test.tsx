import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { ProblemTestsPage } from '../pages/ProblemTestsPage';

function renderProblemTestsPage() {
  return render(
    <MemoryRouter initialEntries={['/problems/collapse/tests']}>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <Routes>
          <Route path="/problems/:problemId/tests" element={<ProblemTestsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('problem tests page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a loading state while the tests request is pending', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}) as never);

    renderProblemTestsPage();

    expect(screen.getByText('Loading problem tests...')).toBeTruthy();
  });

  it('renders separate public and hidden sections', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          problemId: 'collapse',
          publicTests: [
            { input: '0', output: '0' },
            { input: '111', output: '1' }
          ],
          hiddenTests: [{ input: '111122223333', output: '123' }]
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderProblemTestsPage();

    await waitFor(() => {
      expect(screen.getByText('Public Tests')).toBeTruthy();
    });

    expect(screen.getByText('Hidden Tests')).toBeTruthy();
    expect((screen.getByLabelText('Public Tests JSON') as HTMLTextAreaElement).value).toContain(
      '"input": "0"'
    );
    expect((screen.getByLabelText('Hidden Tests JSON') as HTMLTextAreaElement).value).toContain(
      '"input": "111122223333"'
    );
    expect(
      screen.getByText('Hidden tests are admin-only and must never appear in student or public responses.')
    ).toBeTruthy();
  });

  it('sends the updated payload on save', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            problemId: 'collapse',
            publicTests: [{ input: '0', output: '0' }],
            hiddenTests: [{ input: '1111', output: '1' }]
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
            problemId: 'collapse',
            publicTests: [
              { input: '0', output: '0' },
              { input: '12321', output: '12321' }
            ],
            hiddenTests: [{ input: '111122223333', output: '123' }]
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderProblemTestsPage();

    await waitFor(() => {
      expect(screen.getByText('Public Tests')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Public Tests JSON'), {
      target: {
        value: JSON.stringify(
          [
            { input: '0', output: '0' },
            { input: '12321', output: '12321' }
          ],
          null,
          2
        )
      }
    });
    fireEvent.change(screen.getByLabelText('Hidden Tests JSON'), {
      target: {
        value: JSON.stringify([{ input: '111122223333', output: '123' }], null, 2)
      }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Tests saved.')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/problems/collapse/tests',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          publicTests: [
            { input: '0', output: '0' },
            { input: '12321', output: '12321' }
          ],
          hiddenTests: [{ input: '111122223333', output: '123' }]
        })
      })
    );
  });

  it('renders an error state when the tests request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Problem tests are down.'));

    renderProblemTestsPage();

    await waitFor(() => {
      expect(screen.getByText('Problem tests are down.')).toBeTruthy();
    });
  });
});
