import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { AppRoutes } from '../routes/AppRoutes';

function renderCreateFlow() {
  return render(
    <AuthProvider
      initialSession={{
        status: 'authenticated',
        user: { email: 'admin@example.com', role: 'admin' }
      }}
    >
      <MemoryRouter initialEntries={['/admin/problems/create']}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('problem create page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a draft problem and redirects to the editor', async () => {
    const createdProblem = {
      problemId: 'collapse',
      title: 'Collapse Identical Digits',
      entryFunction: 'collapse',
      language: 'python',
      timeLimitMs: 2000,
      memoryLimitKb: 262144,
      visibility: 'draft',
      statementMarkdown: '# Collapse Identical Digits\n\nProblem statement not written yet.\n',
      starterCode:
        'def collapse(number: int) -> int:\n    """\n    Write your solution here.\n    """\n    pass\n',
      updatedAt: '2026-03-10T00:00:00Z'
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createdProblem), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createdProblem), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    renderCreateFlow();

    fireEvent.change(screen.getByLabelText('Problem ID'), {
      target: { value: 'collapse' }
    });
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Collapse Identical Digits' }
    });
    fireEvent.change(screen.getByLabelText('Entry Function'), {
      target: { value: 'collapse' }
    });
    fireEvent.change(screen.getByLabelText('Time Limit (ms)'), {
      target: { value: '2000' }
    });
    fireEvent.change(screen.getByLabelText('Memory Limit (KB)'), {
      target: { value: '262144' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Problem Editor' })).toBeTruthy();
    });

    expect(screen.getByDisplayValue('Collapse Identical Digits')).toBeTruthy();
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8200/admin/problems',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          problemId: 'collapse',
          title: 'Collapse Identical Digits',
          entryFunction: 'collapse',
          language: 'python',
          timeLimitMs: 2000,
          memoryLimitKb: 262144
        })
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/problems/collapse',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token'
        })
      })
    );
  });
});
