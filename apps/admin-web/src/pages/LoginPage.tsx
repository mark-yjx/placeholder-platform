import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { microsoftLoginUrl } from '../auth/client';

function MicrosoftIcon() {
  return (
    <svg aria-hidden="true" className="provider-icon" viewBox="0 0 24 24">
      <path d="M3 3h8v8H3z" fill="#f25022" />
      <path d="M13 3h8v8h-8z" fill="#7fba00" />
      <path d="M3 13h8v8H3z" fill="#00a4ef" />
      <path d="M13 13h8v8h-8z" fill="#ffb900" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { loginLocal } = useAuth();
  const [searchParams] = useSearchParams();
  const externalError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(externalError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const nextStatus = await loginLocal(email, password);
      navigate(nextStatus === 'pending_tfa' ? '/verify-totp' : '/', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-intro">
          <p className="eyebrow">Placeholder Admin</p>
          <h1>Admin Login</h1>
          <p className="message">
            Sign in with local admin credentials or Microsoft, then complete local admin
            verification before entering the control surface.
          </p>
          <p className="hint">
            Both local credentials and Microsoft identity still converge into the same local
            admin authorization and TOTP policy.
          </p>
        </div>

        <section className="card auth-card">
          <div className="auth-card-header">
            <p className="detail-label">Secure Access</p>
            <p className="detail-value">
              Admin Web requires local admin authorization. Microsoft sign-in is optional, not a
              bypass.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error ? <p className="error-message">{error}</p> : null}

            <label className="field">
              <span>Email</span>
              <input
                autoComplete="username"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <a className="secondary-button link-button provider-button" href={microsoftLoginUrl()}>
              <MicrosoftIcon />
              Sign in with Microsoft
            </a>
          </form>
        </section>
      </section>
    </main>
  );
}
