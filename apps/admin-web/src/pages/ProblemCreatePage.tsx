import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createAdminProblem, type AdminProblemCreateRequest } from '../api/problems';
import { AdminLayout } from '../components/AdminLayout';
import { readStoredAdminToken } from '../auth/storage';

type SaveState = 'idle' | 'saving' | 'error';

const DEFAULT_FORM: AdminProblemCreateRequest = {
  problemId: '',
  title: '',
  entryFunction: '',
  language: 'python',
  timeLimitMs: 2000,
  memoryLimitKb: 262144
};

export function ProblemCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<AdminProblemCreateRequest>(DEFAULT_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  function updateField<Key extends keyof AdminProblemCreateRequest>(
    key: Key,
    value: AdminProblemCreateRequest[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) {
      setError(null);
    }
    if (saveState !== 'idle') {
      setSaveState('idle');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = readStoredAdminToken();
    if (!token) {
      setSaveState('error');
      setError('Admin session is missing.');
      return;
    }

    setSaveState('saving');
    setError(null);

    try {
      const created = await createAdminProblem(token, form);
      navigate(`/admin/problems/${created.problemId}`, {
        replace: true,
        state: { initialProblem: created }
      });
    } catch (saveError) {
      setSaveState('error');
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to create the problem.'
      );
    }
  }

  return (
    <AdminLayout
      actions={
        <Link className="secondary-button link-button" to="/admin/problems">
          Back to Problems
        </Link>
      }
      description="Create a new draft problem folder with the initial manifest and files."
      meta="Keep the starting metadata minimal, then continue in the editor."
      title="Create Problem"
    >
      <section className="card content-card">
        <form className="problem-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h2>Basic Info</h2>
            <div className="form-grid">
              <label className="field">
                <span>Problem ID</span>
                <input
                  name="problemId"
                  onChange={(event) => updateField('problemId', event.target.value)}
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
                    updateField('language', event.target.value as AdminProblemCreateRequest['language'])
                  }
                  value={form.language}
                >
                  <option value="python">python</option>
                </select>
              </label>
            </div>
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
            <h2>Actions</h2>
            <div className="form-actions">
              <button className="primary-button" disabled={saveState === 'saving'} type="submit">
                {saveState === 'saving' ? 'Creating...' : 'Create'}
              </button>
              {error ? <p className="error-message">{error}</p> : null}
            </div>
          </section>
        </form>
      </section>
    </AdminLayout>
  );
}
