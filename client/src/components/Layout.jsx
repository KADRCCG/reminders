import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Overview', end: true },
  { to: '/departments', label: 'Departments' },
  { to: '/members', label: 'People' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/celebrations', label: 'Celebrations' },
  { to: '/messages', label: 'Message hub' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  return (
    <div className={`shell${menuOpen ? ' is-open' : ''}`}>
      <header className="mobile-bar">
        <div className="mobile-brand">
          <img className="brand-logo" src="/rccg-logo.png" alt="RCCG-KAD logo" />
          <div className="brand-copy">
            <p className="brand">RCCG-KAD</p>
            <p className="brand-sub">Workforce</p>
          </div>
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className="sidebar">
        <div className="brand-block desktop-only">
          <img className="brand-logo" src="/rccg-logo.png" alt="RCCG-KAD logo" />
          <div className="brand-copy">
            <p className="brand">RCCG-KAD</p>
            <p className="brand-sub">The Redeemed Christian Church of God</p>
            <p className="brand-sub">Workforce Reminders</p>
          </div>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="user-name">{user?.name}</p>
          <button type="button" className="linkish" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
