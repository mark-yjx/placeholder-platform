import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../auth/AuthContext';

export function SettingsPage() {
  const { status, user } = useAuth();

  return (
    <AdminLayout
      actions={null}
      description="Session-level information and workspace guidance for the admin surface."
      meta="Settings remain intentionally light in this MVP."
      title="Settings"
    >
      <section className="card content-card">
        <div className="info-grid">
          <section className="form-section">
            <h2>Admin Session</h2>
            <div className="detail-grid">
              <div>
                <p className="detail-label">Email</p>
                <p className="detail-value">{user?.email ?? 'admin'}</p>
              </div>
              <div>
                <p className="detail-label">Role</p>
                <p className="detail-value">{user?.role ?? 'admin'}</p>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <p className="detail-value">{status}</p>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Workspace</h2>
            <p className="field-note">
              This admin UI focuses on problem authoring and review. Publishing, previews, tests,
              and submission inspection stay available from the primary navigation.
            </p>
            <p className="field-note">
              Student-facing behavior and judge execution remain outside this settings surface.
            </p>
          </section>
        </div>
      </section>
    </AdminLayout>
  );
}
