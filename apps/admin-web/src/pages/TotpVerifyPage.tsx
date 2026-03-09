import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function TotpVerifyPage() {
  const navigate = useNavigate();
  const { pendingExpiresAt, verifyTotp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await verifyTotp(code);
      navigate('/', { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'TOTP verification failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-intro">
          <p className="eyebrow">OJ Admin Web</p>
          <h1>TOTP Verification</h1>
          <p className="message">
            Finish the local admin sign-in by entering the 6-digit authenticator code.
          </p>
          {pendingExpiresAt ? (
            <p className="hint">Pending verification expires at {pendingExpiresAt}.</p>
          ) : null}
        </div>

        <section className="card auth-card">
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Authenticator Code</span>
              <input
                inputMode="numeric"
                maxLength={6}
                name="totp"
                onChange={(event) => setCode(event.target.value)}
                type="text"
                value={code}
              />
            </label>

            {error ? <p className="error-message">{error}</p> : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
