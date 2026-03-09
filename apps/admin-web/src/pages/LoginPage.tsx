import { useSearchParams } from 'react-router-dom';
import { microsoftLoginUrl } from '../auth/client';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-intro">
          <p className="eyebrow">OJ Admin Web</p>
          <h1>Admin Login</h1>
          <p className="message">
            Sign in with Microsoft, then complete local admin verification before entering the
            control surface.
          </p>
          <p className="hint">
            Microsoft identity proves who authenticated. Local platform user mapping and TOTP still
            control who may enter Admin Web.
          </p>
        </div>

        <section className="card auth-card">
          <div className="auth-card-header">
            <p className="detail-label">Secure Access</p>
            <p className="detail-value">
              Admin Web requires Microsoft OIDC and local platform authorization.
            </p>
          </div>

          <div className="auth-form">
            {error ? <p className="error-message">{error}</p> : null}

            <a className="primary-button" href={microsoftLoginUrl()}>
              Sign in with Microsoft
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
