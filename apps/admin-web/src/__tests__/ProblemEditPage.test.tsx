import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { ProblemEditPage } from '../pages/ProblemEditPage';

function renderProblemEditPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/problems/collapse']}>
      <AuthProvider
        initialSession={{
          state: 'authenticated_admin',
          user: { email: 'admin@example.com', role: 'admin', totpEnabled: false }
        }}
      >
        <Routes>
          <Route path="/admin/problems/:problemId" element={<ProblemEditPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('problem edit page', () => {
  beforeEach(() => {
    window.localStorage.setItem('oj.admin.token', 'signed-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a loading state while the detail request is pending', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}) as never);

    renderProblemEditPage();

    expect(screen.getByText('Loading problem details...')).toBeTruthy();
  });

  it('renders the loaded problem fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          problemId: 'collapse',
          title: 'Collapse Identical Digits',
          entryFunction: 'collapse',
          language: 'python',
          timeLimitMs: 2000,
          memoryLimitKb: 65536,
          visibility: 'public',
          statementMarkdown:
            '# Collapse Identical Digits\n\nCollapse duplicate digits.\n\n## Input Format\n\nAn integer.\n\n## Output Format\n\nThe collapsed integer.\n\n## Examples\n\nExample walkthrough.',
          examples: [{ input: 111, output: 1 }],
          starterCode: 'def collapse(number):\n    return number\n',
          updatedAt: '2026-03-09T12:00:00Z'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    renderProblemEditPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Collapse Identical Digits')).toBeTruthy();
    });

    expect((screen.getByLabelText('Problem ID') as HTMLInputElement).value).toBe('collapse');
    expect((screen.getByLabelText('Entry Function') as HTMLInputElement).value).toBe('collapse');
    expect((screen.getByLabelText('Status') as HTMLInputElement).value).toBe('published');
    expect((screen.getByLabelText('Statement Markdown') as HTMLTextAreaElement).value).toBe(
      '# Collapse Identical Digits\n\nCollapse duplicate digits.'
    );
    expect((screen.getByLabelText('Input Format') as HTMLTextAreaElement).value).toBe(
      'An integer.'
    );
    expect((screen.getByLabelText('Output Format') as HTMLTextAreaElement).value).toBe(
      'The collapsed integer.'
    );
    expect((screen.getByLabelText('Example Notes (optional)') as HTMLTextAreaElement).value).toBe(
      'Example walkthrough.'
    );
    expect((screen.getByLabelText('Input') as HTMLTextAreaElement).value).toBe('111');
    expect((screen.getByLabelText('Output') as HTMLTextAreaElement).value).toBe('1');
    expect((screen.getByLabelText('Starter Code') as HTMLTextAreaElement).value).toBe(
      'def collapse(number):\n    return number\n'
    );
  });

  it('sends the updated payload on save', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            problemId: 'collapse',
            title: 'Collapse Identical Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2000,
            memoryLimitKb: 65536,
            visibility: 'public',
            statementMarkdown: '# Collapse Identical Digits',
            examples: [{ input: 111, output: 1 }],
            starterCode: 'def collapse(number):\n    return number\n',
            updatedAt: '2026-03-09T12:00:00Z'
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
            title: 'Collapse Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2500,
            memoryLimitKb: 65536,
            visibility: 'private',
            statementMarkdown:
              '# Collapse Digits\n\nCollapse adjacent repeated digits.\n\n## Input Format\n\nA single integer.\n\n## Output Format\n\nThe integer after collapsing adjacent repeated digits.\n\n## Examples\n\nWork through the repeated runs.',
            examples: [
              { input: 2222, output: 2 },
              { input: 3333, output: 3 }
            ],
            starterCode: 'def collapse(number):\n    return int(number)\n',
            updatedAt: '2026-03-10T00:00:00Z'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderProblemEditPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Collapse Identical Digits')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Collapse Digits' }
    });
    fireEvent.change(screen.getByLabelText('Time Limit (ms)'), {
      target: { value: '2500' }
    });
    fireEvent.change(screen.getByLabelText('Statement Markdown'), {
      target: { value: '# Collapse Digits\n\nCollapse adjacent repeated digits.' }
    });
    fireEvent.change(screen.getByLabelText('Input Format'), {
      target: { value: 'A single integer.' }
    });
    fireEvent.change(screen.getByLabelText('Output Format'), {
      target: { value: 'The integer after collapsing adjacent repeated digits.' }
    });
    fireEvent.change(screen.getByLabelText('Example Notes (optional)'), {
      target: { value: 'Work through the repeated runs.' }
    });
    fireEvent.change(screen.getByLabelText('Input'), {
      target: { value: '2222' }
    });
    fireEvent.change(screen.getByLabelText('Output'), {
      target: { value: '2' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Example' }));
    const inputBoxes = screen.getAllByLabelText('Input');
    const outputBoxes = screen.getAllByLabelText('Output');
    fireEvent.change(inputBoxes[1] as HTMLTextAreaElement, {
      target: { value: '3333' }
    });
    fireEvent.change(outputBoxes[1] as HTMLTextAreaElement, {
      target: { value: '3' }
    });
    fireEvent.change(screen.getByLabelText('Starter Code'), {
      target: { value: 'def collapse(number):\n    return int(number)\n' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Problem saved.')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/problems/collapse',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          problemId: 'collapse',
          title: 'Collapse Digits',
          entryFunction: 'collapse',
          language: 'python',
          timeLimitMs: 2500,
          memoryLimitKb: 65536,
          visibility: 'public',
          statementMarkdown:
            '# Collapse Digits\n\nCollapse adjacent repeated digits.\n\n## Input Format\n\nA single integer.\n\n## Output Format\n\nThe integer after collapsing adjacent repeated digits.\n\n## Examples\n\nWork through the repeated runs.',
          examples: [
            { input: 2222, output: 2 },
            { input: 3333, output: 3 }
          ],
          starterCode: 'def collapse(number):\n    return int(number)\n',
          updatedAt: '2026-03-09T12:00:00Z'
        })
      })
    );
  });

  it('accepts plain-text examples without requiring quotes', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            problemId: 'collapse',
            title: 'Collapse Identical Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2000,
            memoryLimitKb: 65536,
            visibility: 'public',
            statementMarkdown: '# Collapse Identical Digits',
            examples: [],
            starterCode: 'def collapse(number):\n    return number\n',
            updatedAt: '2026-03-09T12:00:00Z'
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
            title: 'Collapse Identical Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2000,
            memoryLimitKb: 65536,
            visibility: 'public',
            statementMarkdown: '# Collapse Identical Digits',
            examples: [{ input: 'one per line', output: 'collapsed result' }],
            starterCode: 'def collapse(number):\n    return number\n',
            updatedAt: '2026-03-10T00:00:00Z'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderProblemEditPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Collapse Identical Digits')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Example' }));
    const inputBoxes = screen.getAllByLabelText('Input');
    const outputBoxes = screen.getAllByLabelText('Output');
    fireEvent.change(inputBoxes[0] as HTMLTextAreaElement, {
      target: { value: 'one per line' }
    });
    fireEvent.change(outputBoxes[0] as HTMLTextAreaElement, {
      target: { value: 'collapsed result' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Problem saved.')).toBeTruthy();
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/problems/collapse',
      expect.objectContaining({
        body: JSON.stringify({
          problemId: 'collapse',
          title: 'Collapse Identical Digits',
          entryFunction: 'collapse',
          language: 'python',
          timeLimitMs: 2000,
          memoryLimitKb: 65536,
          visibility: 'public',
          statementMarkdown: '# Collapse Identical Digits',
          examples: [{ input: 'one per line', output: 'collapsed result' }],
          starterCode: 'def collapse(number):\n    return number\n',
          updatedAt: '2026-03-09T12:00:00Z'
        })
      })
    );
  });

  it('renders an error state when the detail request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Problem detail is down.'));

    renderProblemEditPage();

    await waitFor(() => {
      expect(screen.getByText('Problem detail is down.')).toBeTruthy();
    });
  });

  it('publishes a draft problem from the editor', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            problemId: 'collapse',
            title: 'Collapse Identical Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2000,
            memoryLimitKb: 65536,
            visibility: 'draft',
            statementMarkdown: '# Collapse Identical Digits',
            examples: [],
            starterCode: 'def collapse(number):\n    return number\n',
            updatedAt: '2026-03-09T12:00:00Z'
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
            title: 'Collapse Identical Digits',
            entryFunction: 'collapse',
            language: 'python',
            timeLimitMs: 2000,
            memoryLimitKb: 65536,
            visibility: 'published',
            statementMarkdown: '# Collapse Identical Digits',
            examples: [],
            starterCode: 'def collapse(number):\n    return number\n',
            updatedAt: '2026-03-10T12:00:00Z'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    renderProblemEditPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Collapse Identical Digits')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getByText('Problem published.')).toBeTruthy();
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8200/admin/problems/collapse/publish',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer signed-token'
        })
      })
    );
    expect((screen.getByLabelText('Status') as HTMLInputElement).value).toBe('published');
  });
});
