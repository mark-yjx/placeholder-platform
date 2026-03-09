import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { logout, user } = useAuth();

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">OJ Admin Web</p>
        <h1>Admin Dashboard</h1>
        <p className="message">Admin frontend scaffold is ready.</p>
        <p className="hint">Signed in as {user?.email ?? 'admin'}.</p>
        <button className="secondary-button" onClick={logout} type="button">
          Logout
        </button>
      </section>
    </main>
  );
}
