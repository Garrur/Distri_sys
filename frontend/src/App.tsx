import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import JobsList from './pages/JobsList';
import './index.css';

function Sidebar() {
  return (
    <aside style={{
      width: '260px',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      zIndex: 10,
      background: 'var(--bg-dark)',
      borderRight: '1px solid var(--border-main)',
    }}>
      {/* Top branding block */}
      <div style={{ padding: '2rem 1.75rem', borderBottom: '1px solid var(--border-main)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-terra)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 0.4rem' }}>distri.queue</p>
        <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-main)', fontFamily: 'var(--font-serif)', lineHeight: 1.2, fontWeight: 400 }}>
          Topology
        </h1>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', padding: '1rem 0', flex: 1 }}>
        <NavLink to="/dashboard" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
          System Overview
        </NavLink>
        <NavLink to="/dashboard/jobs" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
          Task Register
        </NavLink>
      </nav>

      {/* Status footer */}
      <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid var(--border-main)' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>Diagnostics</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--accent-success)' }} />
          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>Operational</span>
        </div>
      </div>
    </aside>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-dark)' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: '260px',
        padding: '3rem 4rem',
        position: 'relative',
        zIndex: 1,
      }}>
        {children}
      </main>
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
