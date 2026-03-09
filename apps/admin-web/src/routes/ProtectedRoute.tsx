import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Admin Session</p>
          <h1>Checking session</h1>
          <p className="message">Restoring the admin session.</p>
        </section>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'pending_tfa') {
    return <Navigate to="/verify-totp" replace />;
  }

  return <Outlet />;
}
