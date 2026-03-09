import { FormEvent, useState } from 'react';
import { initTotpEnrollment } from '../auth/client';
import { readStoredAdminToken } from '../auth/storage';
import type { TotpEnrollment } from '../auth/types';
import { AdminLayout } from '../components/AdminLayout';
import { useAuth } from '../auth/AuthContext';

export function SettingsPage() {
  const { status, user, confirmEnrollment } = useAuth();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleStartEnrollment() {
    const token = readStoredAdminToken();
    if (!token) {
      setError('Admin session is invalid.');
      return;
    }

    setIsLoadingEnrollment(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nextEnrollment = await initTotpEnrollment(token);
      setEnrollment(nextEnrollment);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'TOTP enrollment is unavailable.');
    } finally {
      setIsLoadingEnrollment(false);
    }
  }

  async function handleConfirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConfirming(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await confirmEnrollment(code);
      setSuccessMessage('TOTP is now enabled for this admin account.');
      setEnrollment(null);
      setCode('');
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : 'TOTP enrollment confirmation failed.'
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <AdminLayout
      actions={null}
      description="Session-level information, TOTP hardening, and workspace guidance for the admin surface."
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
              <div>
                <p className="detail-label">TOTP</p>
                <p className="detail-value">{user?.totpEnabled ? 'enabled' : 'not enabled'}</p>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>TOTP Hardening</h2>
            <p className="field-note">
              Microsoft sign-in proves who authenticated. Local TOTP adds the second factor for
              this platform account.
            </p>

            {!user?.totpEnabled ? (
              <>
                <button
                  className="primary-button"
                  disabled={isLoadingEnrollment}
                  onClick={() => void handleStartEnrollment()}
                  type="button"
                >
                  {isLoadingEnrollment ? 'Preparing...' : 'Enable TOTP'}
                </button>

                {enrollment ? (
                  <div className="totp-enrollment-card">
                    <p className="detail-label">Secret</p>
                    <p className="detail-value">{enrollment.secret}</p>
                    <p className="field-note">
                      Add this secret to your authenticator app, then confirm the first 6-digit
                      code below.
                    </p>
                    <p className="field-note">otpauth URI: {enrollment.otpauthUri}</p>

                    <form className="auth-form" onSubmit={handleConfirmEnrollment}>
                      <label className="field">
                        <span>First Authenticator Code</span>
                        <input
                          inputMode="numeric"
                          maxLength={6}
                          name="totpEnrollCode"
                          onChange={(event) => setCode(event.target.value)}
                          type="text"
                          value={code}
                        />
                      </label>

                      <button className="primary-button" disabled={isConfirming} type="submit">
                        {isConfirming ? 'Confirming...' : 'Confirm TOTP'}
                      </button>
                    </form>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="success-message">
                TOTP is enabled. Future Microsoft sign-ins will require a second-factor code.
              </p>
            )}

            {error ? <p className="error-message">{error}</p> : null}
            {successMessage ? <p className="success-message">{successMessage}</p> : null}
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
