import { type PropsWithChildren, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type AdminLayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}>;

const NAV_ITEMS = [
  { label: 'Overview', to: '/admin/overview' },
  { label: 'Problems', to: '/admin/problems' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Submissions', to: '/submissions' },
  { label: 'Settings', to: '/settings' }
];

export function AdminLayout({
  title,
  description,
  meta,
  actions,
  children
}: AdminLayoutProps) {
  const { logout, user } = useAuth();

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">OJ Admin Web</p>
          <p className="sidebar-title">Control Center</p>
          <p className="sidebar-copy">
            A quieter workspace for preparing problems and reviewing platform activity.
          </p>
        </div>

        <nav aria-label="Admin navigation" className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item-active' : 'nav-item'
              }
              end={item.to === '/settings'}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <p className="detail-label">Signed in</p>
            <p className="detail-value">{user?.email ?? 'admin'}</p>
          </div>
          <button
            className="secondary-button subtle-button"
            onClick={() => void logout()}
            type="button"
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="hero-card">
          <div>
            <p className="eyebrow">OJ Admin Web</p>
            <h1>{title}</h1>
            <p className="message">{description}</p>
            {meta ? <p className="hint">{meta}</p> : null}
          </div>

          {actions ? <div className="header-actions">{actions}</div> : null}
        </header>

        <div className="page-stack">{children}</div>
      </section>
    </main>
  );
}
