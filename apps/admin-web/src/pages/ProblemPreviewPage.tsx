import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAdminProblemPreview,
  type AdminProblemPreview,
  type AdminProblemPreviewCase
} from '../api/problems';
import { readStoredAdminToken } from '../auth/storage';

type LoadState = 'loading' | 'ready' | 'error';

function renderCaseValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function PreviewCaseTable({
  heading,
  cases,
  emptyMessage
}: {
  heading: string;
  cases: AdminProblemPreviewCase[];
  emptyMessage: string;
}) {
  return (
    <section className="form-section">
      <h2>{heading}</h2>
      {cases.length === 0 ? (
        <p className="hint">{emptyMessage}</p>
      ) : (
        <div className="table-wrap">
          <table className="problems-table">
            <thead>
              <tr>
                <th>Input</th>
                <th>Output</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((testCase, index) => (
                <tr key={`${heading}-${index}`}>
                  <td>
                    <pre className="code-block">{renderCaseValue(testCase.input)}</pre>
                  </td>
                  <td>
                    <pre className="code-block">{renderCaseValue(testCase.output)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ProblemPreviewPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [preview, setPreview] = useState<AdminProblemPreview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreview() {
      if (!problemId) {
        setLoadState('error');
        setError('Problem ID is missing.');
        return;
      }

      const token = readStoredAdminToken();
      if (!token) {
        setLoadState('error');
        setError('Admin session is missing.');
        return;
      }

      setLoadState('loading');
      setError(null);

      try {
        const nextPreview = await fetchAdminProblemPreview(token, problemId);
        setPreview(nextPreview);
        setLoadState('ready');
      } catch (loadError) {
        setPreview(null);
        setLoadState('error');
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the problem preview.');
      }
    }

    void loadPreview();
  }, [problemId]);

  return (
    <main className="shell">
      <section className="card problems-card">
        <div className="page-header">
          <div>
            <p className="eyebrow">OJ Admin Web</p>
            <h1>Problem Preview</h1>
            <p className="message">Student-visible preview for {problemId ?? 'this problem'}.</p>
          </div>

          <div className="header-actions">
            <Link
              className="secondary-button link-button"
              to={problemId ? `/admin/problems/${problemId}` : '/admin/problems'}
            >
              Back to Problem
            </Link>
            <Link className="secondary-button link-button" to="/admin/problems">
              Problems
            </Link>
          </div>
        </div>

        {loadState === 'loading' ? <p className="hint">Loading problem preview...</p> : null}
        {loadState === 'error' && error ? <p className="error-message">{error}</p> : null}

        {loadState === 'ready' && preview ? (
          <div className="problem-form">
            <section className="form-section">
              <h2>Title</h2>
              <p className="detail-value">{preview.title}</p>
            </section>

            <section className="form-section">
              <h2>Statement</h2>
              <pre className="code-block">{preview.statementMarkdown}</pre>
            </section>

            <PreviewCaseTable
              cases={preview.examples}
              emptyMessage="No examples are configured yet."
              heading="Examples"
            />

            <PreviewCaseTable
              cases={preview.publicTests}
              emptyMessage="No public tests are configured yet."
              heading="Public Tests"
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
