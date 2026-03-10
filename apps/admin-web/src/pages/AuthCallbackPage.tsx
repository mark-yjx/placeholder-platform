import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function readHashToken(): string | null {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get('token');
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readHashToken();
    if (!token) {
      setError('Admin callback is missing the session token.');
      return;
    }

    completeCallback(token)
      .then((nextStatus) => {
        window.history.replaceState({}, document.title, '/auth/callback');
        navigate(nextStatus === 'pending_tfa' ? '/verify-totp' : '/', { replace: true });
      })
      .catch((callbackError) => {
        setError(
          callbackError instanceof Error ? callbackError.message : 'Admin callback failed.'
        );
      });
  }, [completeCallback, navigate]);

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-intro">
          <p className="eyebrow">Placeholder Admin</p>
          <h1>Finishing Sign-In</h1>
          <p className="message">
            Completing Microsoft sign-in and restoring the local admin session.
          </p>
        </div>

        <section className="card auth-card">
          {error ? <p className="error-message">{error}</p> : <p className="hint">Signing in…</p>}
        </section>
      </section>
    </main>
  );
}
