import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : 'Admin login failed.'
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
          <h1>Admin Login</h1>
          <p className="message">
            Sign in with the configured admin credentials to manage problems and monitor
            submissions.
          </p>
          <p className="hint">
            The workspace is intentionally light: draft, preview, publish, and review from one calm
            interface.
          </p>
        </div>

        <section className="card auth-card">
          <div className="auth-card-header">
            <p className="detail-label">Secure Access</p>
            <p className="detail-value">Use the configured admin account.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
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

            {error ? <p className="error-message">{error}</p> : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
