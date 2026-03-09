import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  disableAdminUser,
  enableAdminUser,
  fetchAdminUser,
  setAdminUserPassword,
  updateAdminUser,
  type AdminUserDetail
} from '../api/users';
import { readStoredAdminToken } from '../auth/storage';
import { AdminLayout } from '../components/AdminLayout';

type LoadState = 'loading' | 'ready' | 'error';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never';
  }

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

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordState, setPasswordState] = useState<'idle' | 'saving'>('idle');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      if (!userId) {
        setLoadState('error');
        setError('User ID is missing.');
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
        const detail = await fetchAdminUser(token, userId);
        setUser(detail);
        setLoadState('ready');
      } catch (loadError) {
        setUser(null);
        setLoadState('error');
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the selected user.');
      }
    }

    void loadUser();
  }, [userId]);

  function updateField<Key extends keyof AdminUserDetail>(key: Key, value: AdminUserDetail[Key]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));
    setSaveMessage(null);
    setSaveError(null);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !user) {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setSaveError('Admin session is missing.');
      return;
    }

    setSaveState('saving');
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updated = await updateAdminUser(token, userId, {
        displayName: user.displayName,
        role: user.role,
        status: user.status
      });
      setUser(updated);
      setSaveMessage('User profile saved.');
    } catch (submissionError) {
      setSaveError(
        submissionError instanceof Error ? submissionError.message : 'Failed to save user.'
      );
    } finally {
      setSaveState('idle');
    }
  }

  async function handleStatusChange(nextStatus: 'active' | 'disabled') {
    if (!userId) {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setSaveError('Admin session is missing.');
      return;
    }

    setSaveState('saving');
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updated =
        nextStatus === 'active'
          ? await enableAdminUser(token, userId)
          : await disableAdminUser(token, userId);
      setUser(updated);
      setSaveMessage(nextStatus === 'active' ? 'User enabled.' : 'User disabled.');
    } catch (statusError) {
      setSaveError(statusError instanceof Error ? statusError.message : 'Failed to update status.');
    } finally {
      setSaveState('idle');
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const token = readStoredAdminToken();
    if (!token) {
      setPasswordError('Admin session is missing.');
      return;
    }

    setPasswordState('saving');
    setPasswordMessage(null);
    setPasswordError(null);

    try {
      const updated = await setAdminUserPassword(token, userId, password);
      setUser(updated);
      setPassword('');
      setPasswordMessage('Password updated.');
    } catch (submissionError) {
      setPasswordError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Failed to update the password.'
      );
    } finally {
      setPasswordState('idle');
    }
  }

  return (
    <AdminLayout
      actions={
        <>
          <Link className="secondary-button link-button" to="/admin/users">
            Back to Users
          </Link>
          {user ? (
            <button
              className="secondary-button"
              onClick={() => void handleStatusChange(user.status === 'active' ? 'disabled' : 'active')}
              type="button"
            >
              {user.status === 'active' ? 'Disable User' : 'Enable User'}
            </button>
          ) : null}
        </>
      }
      description="Inspect and manage the platform account state for a single user."
      meta={user ? `${user.email} · ${user.userId}` : null}
      title="User Detail"
    >
      <section className="card content-card">
        {loadState === 'loading' ? <p className="hint">Loading user details...</p> : null}
        {loadState === 'error' && error ? <p className="error-message">{error}</p> : null}

        {loadState === 'ready' && user ? (
          <div className="problem-form">
            <section className="form-section">
              <h2>Account Metadata</h2>
              <div className="detail-grid">
                <div>
                  <p className="detail-label">User ID</p>
                  <p className="detail-value">{user.userId}</p>
                </div>
                <div>
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{user.email}</p>
                </div>
                <div>
                  <p className="detail-label">Status</p>
                  <p className="detail-value">
                    <span className={`status-pill ${user.status}`}>{user.status}</span>
                  </p>
                </div>
                <div>
                  <p className="detail-label">Role</p>
                  <p className="detail-value">
                    <span className={`status-pill ${user.role}`}>{user.role}</span>
                  </p>
                </div>
                <div>
                  <p className="detail-label">Created At</p>
                  <p className="detail-value">{formatTimestamp(user.createdAt)}</p>
                </div>
                <div>
                  <p className="detail-label">Updated At</p>
                  <p className="detail-value">{formatTimestamp(user.updatedAt)}</p>
                </div>
                <div>
                  <p className="detail-label">Last Login</p>
                  <p className="detail-value">{formatTimestamp(user.lastLoginAt)}</p>
                </div>
              </div>
            </section>

            <section className="form-section">
              <h2>Edit Profile</h2>
              <form className="problem-form" onSubmit={handleSaveProfile}>
                <div className="form-grid">
                  <label className="field">
                    <span>Display Name</span>
                    <input
                      name="displayName"
                      onChange={(event) => updateField('displayName', event.target.value)}
                      type="text"
                      value={user.displayName}
                    />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select
                      name="role"
                      onChange={(event) =>
                        updateField('role', event.target.value as AdminUserDetail['role'])
                      }
                      value={user.role}
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
                        updateField('status', event.target.value as AdminUserDetail['status'])
                      }
                      value={user.status}
                    >
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </label>
                </div>

                {saveError ? <p className="error-message">{saveError}</p> : null}
                {saveMessage ? <p className="success-message">{saveMessage}</p> : null}

                <div className="form-actions">
                  <button className="primary-button" disabled={saveState === 'saving'} type="submit">
                    {saveState === 'saving' ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={saveState === 'saving'}
                    onClick={() => void handleStatusChange(user.status === 'active' ? 'disabled' : 'active')}
                    type="button"
                  >
                    {user.status === 'active' ? 'Disable User' : 'Enable User'}
                  </button>
                </div>
              </form>
            </section>

            <section className="form-section">
              <h2>Set / Reset Password</h2>
              <p className="field-note">
                Passwords are stored as hashes. This action replaces the current password.
              </p>

              <form className="problem-form" onSubmit={handlePasswordReset}>
                <label className="field">
                  <span>New Password</span>
                  <input
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </label>

                {passwordError ? <p className="error-message">{passwordError}</p> : null}
                {passwordMessage ? <p className="success-message">{passwordMessage}</p> : null}

                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={passwordState === 'saving'}
                    type="submit"
                  >
                    {passwordState === 'saving' ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </section>
    </AdminLayout>
  );
}
