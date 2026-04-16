import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import JobsList from './pages/JobsList';
import './index.css';

function Sidebar() {
  return (
    <aside style={{
      width: '320px',
      padding: '3rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      zIndex: 10
    }}>
      <div className="glass-panel" style={{
        height: '100%',
        padding: '2.5rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            marginBottom: '3rem', 
            color: 'var(--text-main)',
            lineHeight: 1.1
          }}>
            Topology
          </h1>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <NavLink to="/" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              System Overview
            </NavLink>
            <NavLink to="/jobs" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              Task Register
            </NavLink>
          </nav>
        </div>

        <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(232, 225, 217, 0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>Diagnostics</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-olive)', boxShadow: '0 0 8px var(--accent-olive)' }}></div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  return (
    <Router>
      <div className="grain-overlay" aria-hidden="true" />
      
      {/* Decorative background blurs to enhance glass effect without neon */}
      <div style={{
        position: 'fixed', top: '10%', right: '15%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(199, 92, 42, 0.03) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', left: '20%', width: '30vw', height: '30vw',
        background: 'radial-gradient(circle, rgba(212, 175, 55, 0.02) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />

      <div style={{ display: 'flex', minHeight: '100vh', width: '100%', position: 'relative', zIndex: 1 }}>
        <Sidebar />
        <main style={{ 
          flex: 1, 
          marginLeft: '320px',
          padding: '3rem 4rem',
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<JobsList />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
