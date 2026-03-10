import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  fetchAdminProblem,
  publishAdminProblem,
  updateAdminProblem,
  type AdminProblemDetail
} from '../api/problems';
import { AdminLayout } from '../components/AdminLayout';
import { readStoredAdminToken } from '../auth/storage';
import {
  buildProblemStatementMarkdown,
  splitProblemStatementMarkdown
} from '../problemStatementSections';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';
type PublishState = 'idle' | 'publishing' | 'success' | 'error';
type ProblemEditorForm = AdminProblemDetail & {
  statementBodyMarkdown: string;
  inputFormatMarkdown: string;
  outputFormatMarkdown: string;
};

function toEditorForm(problem: AdminProblemDetail): ProblemEditorForm {
  const sections = splitProblemStatementMarkdown(problem.statementMarkdown);
  return {
    ...problem,
    statementBodyMarkdown: sections.bodyMarkdown,
    inputFormatMarkdown: sections.inputFormatMarkdown,
    outputFormatMarkdown: sections.outputFormatMarkdown
  };
}

function toProblemDetailPayload(form: ProblemEditorForm): AdminProblemDetail {
  return {
    problemId: form.problemId,
    title: form.title,
    entryFunction: form.entryFunction,
    language: form.language,
    timeLimitMs: form.timeLimitMs,
    memoryLimitKb: form.memoryLimitKb,
    visibility: form.visibility,
    statementMarkdown: buildProblemStatementMarkdown({
      bodyMarkdown: form.statementBodyMarkdown,
      inputFormatMarkdown: form.inputFormatMarkdown,
      outputFormatMarkdown: form.outputFormatMarkdown
    }),
    starterCode: form.starterCode,
    updatedAt: form.updatedAt
  };
}

function formatVisibilityLabel(value: AdminProblemDetail['visibility']): string {
  if (value === 'public') {
    return 'published';
  }
  if (value === 'private') {
    return 'archived';
  }
  return value;
}

export function ProblemEditPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const location = useLocation();
  const initialProblem =
    (location.state as { initialProblem?: AdminProblemDetail } | null)?.initialProblem ?? null;
  const [form, setForm] = useState<ProblemEditorForm | null>(
    initialProblem && initialProblem.problemId === problemId ? toEditorForm(initialProblem) : null
  );
  const [loadState, setLoadState] = useState<LoadState>(
    initialProblem && initialProblem.problemId === problemId ? 'ready' : 'loading'
  );
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function loadProblem() {
      if (!problemId) {
        if (!isDisposed) {
          setLoadState('error');
          setError('Problem ID is missing.');
        }
        return;
      }

      const token = readStoredAdminToken();
      if (!token) {
        if (!isDisposed) {
          setLoadState('error');
          setError('Admin session is missing.');
        }
        return;
      }

      if (!isDisposed) {
        setLoadState('loading');
        setError(null);
      }

      try {
        const problem = await fetchAdminProblem(token, problemId);
        if (!isDisposed) {
          setForm(toEditorForm(problem));
          setLoadState('ready');
        }
      } catch (loadError) {
        if (!isDisposed) {
          setForm(null);
          setLoadState('error');
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load the selected problem.'
          );
        }
      }
    }

    void loadProblem();

    return () => {
      isDisposed = true;
    };
  }, [problemId]);

  function updateField<Key extends keyof ProblemEditorForm>(
    key: Key,
    value: ProblemEditorForm[Key]
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    if (saveState !== 'idle') {
      setSaveState('idle');
      setSaveMessage(null);
    }
    if (publishState !== 'idle') {
      setPublishState('idle');
      setPublishMessage(null);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!problemId || !form) {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setSaveState('error');
      setSaveMessage('Admin session is missing.');
      return;
    }

    setSaveState('saving');
    setSaveMessage(null);

    try {
      const updated = await updateAdminProblem(token, problemId, toProblemDetailPayload(form));
      setForm(toEditorForm(updated));
      setSaveState('success');
      setSaveMessage('Problem saved.');
    } catch (saveError) {
      setSaveState('error');
      setSaveMessage(
        saveError instanceof Error ? saveError.message : 'Failed to save the problem.'
      );
    }
  }

  async function handlePublish() {
    if (!problemId || !form || form.visibility === 'published' || form.visibility === 'public') {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setPublishState('error');
      setPublishMessage('Admin session is missing.');
      return;
    }

    setPublishState('publishing');
    setPublishMessage(null);

    try {
      const published = await publishAdminProblem(token, problemId);
      setForm(toEditorForm(published));
      setPublishState('success');
      setPublishMessage('Problem published.');
    } catch (publishError) {
      setPublishState('error');
      setPublishMessage(
        publishError instanceof Error ? publishError.message : 'Failed to publish the problem.'
      );
    }
  }

  const statusLabel = form ? formatVisibilityLabel(form.visibility) : 'draft';
  const isPublished = form ? ['published', 'public'].includes(form.visibility) : false;

  return (
    <AdminLayout
      actions={
        <>
          <Link
            className="secondary-button link-button"
            to={problemId ? `/admin/problems/${problemId}/preview` : '/admin/problems'}
          >
            Preview
          </Link>
          <Link
            className="secondary-button link-button"
            to={problemId ? `/admin/problems/${problemId}/tests` : '/admin/problems'}
          >
            Tests
          </Link>
          <Link className="secondary-button link-button" to="/admin/problems">
            Back to Problems
          </Link>
        </>
      }
      description="View and update the latest admin-managed problem metadata."
      meta={
        form ? (
          <>
            Current status <span className={`status-pill ${statusLabel}`}>{statusLabel}</span>
          </>
        ) : null
      }
      title="Problem Editor"
    >
      <section className="card content-card">
        {loadState === 'loading' ? <p className="hint">Loading problem details...</p> : null}
        {loadState === 'error' && error ? <p className="error-message">{error}</p> : null}

        {loadState === 'ready' && form ? (
          <form className="problem-form" onSubmit={handleSave}>
            <section className="form-section">
              <h2>Basic Info</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Problem ID</span>
                  <input
                    name="problemId"
                    onChange={(event) => updateField('problemId', event.target.value)}
                    readOnly
                    value={form.problemId}
                  />
                </label>
                <label className="field">
                  <span>Title</span>
                  <input
                    name="title"
                    onChange={(event) => updateField('title', event.target.value)}
                    value={form.title}
                  />
                </label>
                <label className="field">
                  <span>Entry Function</span>
                  <input
                    name="entryFunction"
                    onChange={(event) => updateField('entryFunction', event.target.value)}
                    value={form.entryFunction}
                  />
                </label>
                <label className="field">
                  <span>Language</span>
                  <select
                    name="language"
                    onChange={(event) =>
                      updateField('language', event.target.value as AdminProblemDetail['language'])
                    }
                    value={form.language}
                  >
                    <option value="python">python</option>
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <input readOnly value={statusLabel} />
                </label>
              </div>
              <p className="field-note">
                Problem ID stays read-only in this MVP to preserve identity. Use Preview and Publish
                to control student visibility.
              </p>
            </section>

            <section className="form-section">
              <h2>Limits</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Time Limit (ms)</span>
                  <input
                    min={1}
                    name="timeLimitMs"
                    onChange={(event) => updateField('timeLimitMs', Number(event.target.value))}
                    type="number"
                    value={form.timeLimitMs}
                  />
                </label>
                <label className="field">
                  <span>Memory Limit (KB)</span>
                  <input
                    min={1}
                    name="memoryLimitKb"
                    onChange={(event) => updateField('memoryLimitKb', Number(event.target.value))}
                    type="number"
                    value={form.memoryLimitKb}
                  />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h2>Statement</h2>
              <label className="field">
                <span>Statement Markdown</span>
                <textarea
                  className="code-area"
                  name="statementBodyMarkdown"
                  onChange={(event) => updateField('statementBodyMarkdown', event.target.value)}
                  rows={14}
                  value={form.statementBodyMarkdown}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Input Format</span>
                  <textarea
                    className="code-area"
                    name="inputFormatMarkdown"
                    onChange={(event) => updateField('inputFormatMarkdown', event.target.value)}
                    rows={6}
                    value={form.inputFormatMarkdown}
                  />
                </label>
                <label className="field">
                  <span>Output Format</span>
                  <textarea
                    className="code-area"
                    name="outputFormatMarkdown"
                    onChange={(event) => updateField('outputFormatMarkdown', event.target.value)}
                    rows={6}
                    value={form.outputFormatMarkdown}
                  />
                </label>
              </div>
              <p className="field-note">
                Input and Output are saved as dedicated markdown sections so the student extension
                can render them in the problem detail view.
              </p>
            </section>

            <section className="form-section">
              <h2>Starter Code</h2>
              <label className="field">
                <span>Starter Code</span>
                <textarea
                  className="code-area"
                  name="starterCode"
                  onChange={(event) => updateField('starterCode', event.target.value)}
                  rows={16}
                  value={form.starterCode}
                />
              </label>
            </section>

            <section className="form-section">
              <h2>Actions</h2>
              <div className="form-actions">
                <button className="primary-button" disabled={saveState === 'saving'} type="submit">
                  {saveState === 'saving' ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="secondary-button"
                  disabled={publishState === 'publishing' || isPublished}
                  onClick={() => void handlePublish()}
                  type="button"
                >
                  {publishState === 'publishing'
                    ? 'Publishing...'
                    : isPublished
                      ? 'Unpublish'
                      : 'Publish'}
                </button>
                {saveMessage ? (
                  <p className={saveState === 'success' ? 'success-message' : 'error-message'}>
                    {saveMessage}
                  </p>
                ) : null}
                {publishMessage ? (
                  <p className={publishState === 'success' ? 'success-message' : 'error-message'}>
                    {publishMessage}
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
