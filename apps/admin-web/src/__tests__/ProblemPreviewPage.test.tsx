import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { ProblemPreviewPage } from '../pages/ProblemPreviewPage';

function renderProblemPreviewPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/problems/collapse/preview']}>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <Routes>
          <Route path="/admin/problems/:problemId/preview" element={<ProblemPreviewPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('problem preview page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the student-visible preview without hidden tests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          problemId: 'collapse',
          title: 'Collapse Identical Digits',
          statementMarkdown: '# Collapse Identical Digits\n\nCollapse adjacent repeated digits.',
          examples: [{ input: 111, output: 1 }],
          publicTests: [{ input: 12321, output: 12321 }]
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderProblemPreviewPage();

    await waitFor(() => {
      expect(screen.getByText('Collapse Identical Digits')).toBeTruthy();
    });

    expect(screen.getByText('Examples')).toBeTruthy();
    expect(screen.getByText('Public Tests')).toBeTruthy();
    expect(screen.queryByText('Hidden Tests')).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8200/admin/problems/collapse/preview',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token'
        })
      })
    );
  });
});
