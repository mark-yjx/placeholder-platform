import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAdminProblemTests,
  updateAdminProblemTests,
  type AdminProblemTestCase
} from '../api/tests';
import { AdminLayout } from '../components/AdminLayout';
import { readStoredAdminToken } from '../auth/storage';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';

function formatEditorValue(testCases: AdminProblemTestCase[]): string {
  return JSON.stringify(testCases, null, 2);
}

function parseEditorValue(value: string, sectionName: string): AdminProblemTestCase[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${sectionName} must be valid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${sectionName} must be a JSON array.`);
  }

  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`${sectionName} item ${index + 1} must be an object.`);
    }

    const input = 'input' in item ? item.input : undefined;
    const output = 'output' in item ? item.output : undefined;

    if (typeof input !== 'string' || typeof output !== 'string') {
      throw new Error(`${sectionName} item ${index + 1} must include string input/output.`);
    }

    return { input, output };
  });
}

export function ProblemTestsPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [publicTestsText, setPublicTestsText] = useState('[]');
  const [hiddenTestsText, setHiddenTestsText] = useState('[]');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProblemTests() {
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
        const tests = await fetchAdminProblemTests(token, problemId);
        setPublicTestsText(formatEditorValue(tests.publicTests));
        setHiddenTestsText(formatEditorValue(tests.hiddenTests));
        setLoadState('ready');
      } catch (loadError) {
        setLoadState('error');
        setError(loadError instanceof Error ? loadError.message : 'Failed to load problem tests.');
      }
    }

    void loadProblemTests();
  }, [problemId]);

  function resetSaveState() {
    if (saveState !== 'idle') {
      setSaveState('idle');
      setSaveMessage(null);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!problemId) {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setSaveState('error');
      setSaveMessage('Admin session is missing.');
      return;
    }

    let publicTests: AdminProblemTestCase[];
    let hiddenTests: AdminProblemTestCase[];

    try {
      publicTests = parseEditorValue(publicTestsText, 'Public tests');
      hiddenTests = parseEditorValue(hiddenTestsText, 'Hidden tests');
    } catch (parseError) {
      setSaveState('error');
      setSaveMessage(parseError instanceof Error ? parseError.message : 'Invalid test JSON.');
      return;
    }

    setSaveState('saving');
    setSaveMessage(null);

    try {
      const updated = await updateAdminProblemTests(token, problemId, {
        publicTests,
        hiddenTests
      });
      setPublicTestsText(formatEditorValue(updated.publicTests));
      setHiddenTestsText(formatEditorValue(updated.hiddenTests));
      setSaveState('success');
      setSaveMessage('Tests saved.');
    } catch (saveError) {
      setSaveState('error');
      setSaveMessage(saveError instanceof Error ? saveError.message : 'Failed to save problem tests.');
    }
  }

  return (
    <AdminLayout
      actions={
        <>
          <Link
            className="secondary-button link-button"
            to={problemId ? `/admin/problems/${problemId}` : '/admin/problems'}
          >
            Back to Problem
          </Link>
          <Link className="secondary-button link-button" to="/admin/problems">
            Problems
          </Link>
        </>
      }
      description={`Edit public and hidden tests separately for ${problemId ?? 'this problem'}.`}
      meta="Hidden tests remain admin-only and are excluded from student preview surfaces."
      title="Problem Tests"
    >
      <section className="card content-card">
        {loadState === 'loading' ? <p className="hint">Loading problem tests...</p> : null}
        {loadState === 'error' && error ? <p className="error-message">{error}</p> : null}

        {loadState === 'ready' ? (
          <form className="problem-form" onSubmit={handleSave}>
            <section className="form-section">
              <h2>Public Tests</h2>
              <p className="field-note">
                These test cases are admin-editable examples and can be visible in student-facing
                authoring contexts when exposed elsewhere.
              </p>
              <label className="field">
                <span>Public Tests JSON</span>
                <textarea
                  className="code-area"
                  name="publicTests"
                  onChange={(event) => {
                    setPublicTestsText(event.target.value);
                    resetSaveState();
                  }}
                  rows={14}
                  value={publicTestsText}
                />
              </label>
            </section>

            <section className="form-section">
              <h2>Hidden Tests</h2>
              <p className="field-note">
                Hidden tests are admin-only and must never appear in student or public responses.
              </p>
              <label className="field">
                <span>Hidden Tests JSON</span>
                <textarea
                  className="code-area"
                  name="hiddenTests"
                  onChange={(event) => {
                    setHiddenTestsText(event.target.value);
                    resetSaveState();
                  }}
                  rows={14}
                  value={hiddenTestsText}
                />
              </label>
            </section>

            <section className="form-section">
              <h2>Actions</h2>
              <div className="form-actions">
                <button className="primary-button" disabled={saveState === 'saving'} type="submit">
                  {saveState === 'saving' ? 'Saving...' : 'Save'}
                </button>
                {saveMessage ? (
                  <p className={saveState === 'success' ? 'success-message' : 'error-message'}>
                    {saveMessage}
                  </p>
                ) : null}
              </div>
            </section>
          </form>
        ) : null}
      </section>
    </AdminLayout>
  );
}
