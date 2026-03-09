import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createAdminUser,
  fetchAdminUsers,
  type AdminUserCreateRequest,
  type AdminUserListItem
} from '../api/users';
import { readStoredAdminToken } from '../auth/storage';
import { useAuth } from '../auth/AuthContext';
import { AdminLayout } from '../components/AdminLayout';

type LoadState = 'loading' | 'ready' | 'error';

const EMPTY_CREATE_FORM: AdminUserCreateRequest = {
  email: '',
  displayName: '',
  role: 'student',
  status: 'active',
  password: ''
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function UsersListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createForm, setCreateForm] = useState<AdminUserCreateRequest>(EMPTY_CREATE_FORM);
  const [createState, setCreateState] = useState<'idle' | 'saving'>('idle');
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadUsers() {
    const token = readStoredAdminToken();
    if (!token) {
      setUsers([]);
      setState('error');
      setError('Admin session is missing.');
      return;
    }

    setError(null);
    setState((currentState) => (currentState === 'ready' ? currentState : 'loading'));
    setIsRefreshing(true);

    try {
      const items = await fetchAdminUsers(token);
      setUsers(items);
      setState('ready');
    } catch (loadError) {
      setUsers([]);
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load users.');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = readStoredAdminToken();
    if (!token) {
      setCreateError('Admin session is missing.');
      return;
    }

    setCreateState('saving');
    setCreateError(null);

    try {
      const created = await createAdminUser(token, createForm);
      setCreateForm(EMPTY_CREATE_FORM);
      await loadUsers();
      navigate(`/admin/users/${created.userId}`);
    } catch (creationError) {
      setCreateError(
        creationError instanceof Error ? creationError.message : 'Failed to create user.'
      );
    } finally {
      setCreateState('idle');
    }
  }

  return (
    <AdminLayout
      actions={
        <button className="secondary-button" onClick={() => void loadUsers()} type="button">
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      }
      description="Manage platform users from the admin-only workspace without touching the student extension."
      meta={`Signed in as ${user?.email ?? 'admin'}.`}
      title="Users"
    >
      <section className="card content-card">
        <div className="form-section">
          <h2>Create User</h2>
          <p className="field-note">
            Create platform users with an explicit role, explicit status, and a hashed password.
          </p>

          <form className="problem-form" onSubmit={handleCreateUser}>
            <div className="form-grid">
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={createForm.email}
                />
              </label>
              <label className="field">
                <span>Display Name</span>
                <input
                  name="displayName"
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  type="text"
                  value={createForm.displayName}
                />
              </label>
              <label className="field">
                <span>Role</span>
                <select
                  name="role"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target.value as AdminUserCreateRequest['role']
                    }))
                  }
                  value={createForm.role}
                >
                  <option value="student">student</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  name="status"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      status: event.target.value as AdminUserCreateRequest['status']
                    }))
                  }
                  value={createForm.status}
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Initial Password</span>
              <input
                name="password"
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, password: event.target.value }))
                }
                type="password"
                value={createForm.password}
              />
            </label>

            {createError ? <p className="error-message">{createError}</p> : null}

            <div className="form-actions">
              <button className="primary-button" disabled={createState === 'saving'} type="submit">
                {createState === 'saving' ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card content-card table-card">
        {state === 'loading' ? <p className="hint">Loading users...</p> : null}
        {state === 'error' && error ? <p className="error-message">{error}</p> : null}
        {state === 'ready' && users.length === 0 ? (
          <p className="hint">No platform users are available yet.</p>
        ) : null}

        {state === 'ready' && users.length > 0 ? (
          <div className="table-wrap">
            <table className="problems-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((platformUser) => (
                  <tr key={platformUser.userId}>
                    <td>
                      <Link className="problem-link" to={`/admin/users/${platformUser.userId}`}>
                        {platformUser.email}
                      </Link>
                    </td>
                    <td>{platformUser.displayName}</td>
                    <td>
                      <span className={`status-pill ${platformUser.role}`}>{platformUser.role}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${platformUser.status}`}>{platformUser.status}</span>
                    </td>
                    <td>{formatTimestamp(platformUser.createdAt)}</td>
                    <td>
                      <Link className="problem-link" to={`/admin/users/${platformUser.userId}`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AdminLayout>
  );
}
