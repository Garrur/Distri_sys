import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import JobsList from './pages/JobsList';
import './index.css';

function Sidebar() {
  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{
        height: 'var(--header-h)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)', letterSpacing: '-0.02em' }}>
          Distri
        </div>
        <div style={{
          marginLeft: 8, fontSize: '0.65rem', fontWeight: 600,
          background: 'var(--teal-bg)', color: 'var(--teal)',
          border: '1px solid var(--teal-light)',
          borderRadius: '999px', padding: '2px 8px', letterSpacing: '0.04em',
        }}>
          v1.0
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 12px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px', margin: 0 }}>
          System
        </p>
        <NavLink to="/dashboard" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
          Overview
        </NavLink>
        <NavLink to="/dashboard/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h11M2 11h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Task Register
        </NavLink>
      </nav>

      {/* Status footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--subtle)', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Diagnostics
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 0 3px rgba(16,185,129,0.15)',
          }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-2)' }}>Operational</span>
        </div>
      </div>
    </aside>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column' }}>
        {/* Top header bar */}
        <header style={{
          height: 'var(--header-h)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 32px', gap: 12,
          position: 'sticky', top: 0, zIndex: 5,
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--subtle)' }}>
            distri.queue / production
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--green-bg)', color: '#059669',
            borderRadius: '999px', padding: '4px 10px',
            fontSize: '0.72rem', fontWeight: 600,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
            Live
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '32px 40px', maxWidth: '1280px', width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
        <Route path="/dashboard/jobs" element={<DashboardLayout><JobsList /></DashboardLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
