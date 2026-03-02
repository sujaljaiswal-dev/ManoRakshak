import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '⬡', label: 'Dashboard' },
  { to: '/chat', icon: '◈', label: 'Chat' },
  { to: '/stress-relief', icon: '◉', label: 'Stress Relief' },
  { to: '/journal', icon: '◻', label: 'Journal' },
];

export default function Layout() {
  const { logout, isIncognito, toggleIncognito, toggleSlowMode, manualSlowMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pageKey, setPageKey] = useState(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setPageKey(location.pathname);
    setSidebarOpen(false); // close sidebar on route change (mobile)
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
          <span className={`ham-line ${sidebarOpen ? 'open' : ''}`} />
          <span className={`ham-line ${sidebarOpen ? 'open' : ''}`} />
          <span className={`ham-line ${sidebarOpen ? 'open' : ''}`} />
        </button>
        <div className="mobile-logo">
          <span>🌿</span>
          <span>ManoRakshak</span>
        </div>
        {isIncognito && <span className="incognito-badge">Incognito</span>}
      </div>

      {/* ── Overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isIncognito ? 'incognito' : ''} ${sidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <span>🌿</span>
          </div>
          <div className="logo-text">
            <h2>ManoRakshak 1.1</h2>
            {isIncognito && <span className="incognito-badge">Incognito</span>}
          </div>
        </div>

        {/* Nav */}
        <ul className="nav-links">
          {NAV_ITEMS.map(({ to, icon, label }, i) => (
            <li key={to} style={{ '--stagger': i }}>
              <NavLink to={to} className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
                <span className="nav-glow" />
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Bottom controls */}
        <div className="sidebar-bottom">
          <button className={`incognito-toggle ${isIncognito ? 'active' : ''}`} onClick={toggleIncognito}>
            <span>🕵️</span>
            <span className="toggle-label">Incognito</span>
            <div className={`toggle-switch ${isIncognito ? 'on' : ''}`}><div className="toggle-knob" /></div>
          </button>
          <button className={`incognito-toggle ${manualSlowMode ? 'active' : ''}`} onClick={toggleSlowMode}
            title="Enable Data Saver Mode to disable voice and camera features">
            <span>📶</span>
            <span className="toggle-label">Data Saver</span>
            <div className={`toggle-switch ${manualSlowMode ? 'on' : ''}`}><div className="toggle-knob" /></div>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <span>↩</span> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={`main-content ${isIncognito ? 'incognito' : ''}`}
        key={pageKey}>
        <Outlet />
      </main>
    </div>
  );
}
