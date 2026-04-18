import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';


const features = [
  { icon: '⚡', title: 'Priority Queues', desc: 'Three dedicated Redis LISTs checked left-to-right. High-priority jobs always dequeued first with zero sorting overhead.' },
  { icon: '🛡️', title: 'Fault Tolerant',  desc: 'Exponential backoff with jitter. Dead-letter routing after max attempts. Stalled-job watchdog via heartbeat TTL.' },
  { icon: '🔓', title: 'Zero Lock-In',    desc: 'Every job is a plain Redis HASH. Query with any client. No proprietary formats. HGETALL job:id and you have everything.' },
  { icon: '🔬', title: 'Atomic Ops',      desc: 'All state transitions executed via Lua scripts on the Redis server. No MULTI/EXEC locks, no TOCTOU race conditions.' },
  { icon: '📈', title: '10k+ Jobs/sec',   desc: 'Measured on a MacBook M2 with concurrency=10. No cloud infra. No paid benchmark service. Just Redis and Node.' },
  { icon: '🔭', title: 'Full Visibility',  desc: 'Real-time dashboard with queue depth, latency stats, failure tracking, and one-click job retry.' },
];

export default function Landing() {
  const [copied, setCopied] = useState(false);
  const [stats, setStats]   = useState({ throughput: 0, reliability: 0 });

  const benchRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  /* counters */
  useEffect(() => {
    const ease = (x: number) => 1 - Math.pow(1 - x, 4);
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        let t0: number | null = null;
        const step = (ts: number) => {
          if (!t0) t0 = ts;
          const p = Math.min((ts - t0) / 2000, 1);
          setStats({ throughput: Math.floor(ease(p) * 10847), reliability: ease(p) * 99.97 });
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.1 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  /* bench bars */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        (e.target.querySelectorAll('.benchmark-bar') as NodeListOf<HTMLElement>)
          .forEach(b => { b.style.width = b.getAttribute('data-width') || '0%'; });
        obs.unobserve(e.target);
      });
    }, { threshold: 0.1 });
    if (benchRef.current) obs.observe(benchRef.current);
    return () => obs.disconnect();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install distri-task-sdk');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="landing-page">

      {/* ── Navbar ───────────────────────────── */}
      <nav>
        <div className="container nav-inner">
          <div className="logo">DISTRI</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="https://github.com/Garrur/Distri_sys" target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <div className="nav-cta">
            <div className="status-indicator">
              <div className="dot" />
              Live
            </div>
            <Link to="/dashboard"><button className="btn-ghost">Dashboard</button></Link>
            <button className="btn-teal" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'npm install'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────── */}
      <section className="container hero">
        <div className="hero-left">
          <div className="hero-badge">
            <span>⚡</span> Open-source · Redis-native · v1.0.0
          </div>
          <h1>
            The task queue that does not hide <em>what it does.</em>
          </h1>
          <p className="hero-sub">
            Priority queues. Exponential backoff. Dead-letter routing. Stalled-job recovery.
            Built entirely on Redis primitives you already understand.
          </p>
          <div className="ctas">
            <button className="install-strip" onClick={handleCopy}>
              <span className="prompt">$</span>
              npm install distri-task-sdk
              <span className="copy-icon">⎘</span>
            </button>
            <Link to="/dashboard">
              <button className="btn-teal">Boot Dashboard →</button>
            </Link>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-code-card">
            <div className="code-header">
              <div className="code-dot r"/><div className="code-dot y"/><div className="code-dot g"/>
              <span className="code-tab">producer.ts</span>
            </div>
            <div className="code-body">
              <span className="kw">import</span> {'{ DistriQueue }'} <span className="kw">from</span> <span className="str">'distri-task-sdk'</span>{'\n\n'}
              <span className="kw">const</span> queue = <span className="kw">new</span> <span className="fn">DistriQueue</span>{'({ redis })'}{'\n\n'}
              <span className="kw">await</span> queue.<span className="fn">enqueue</span>({'({'}{'\n'}
              {'  '}<span className="fn">type</span>: <span className="str">'send-email'</span>,{'\n'}
              {'  '}<span className="fn">data</span>: {'{ to: '}<span className="str">'user@example.com'</span>{' },'}{'\n'}
              {'  '}<span className="fn">priority</span>: <span className="str">'high'</span>,{'\n'}
              {'  '}<span className="fn">maxAttempts</span>: <span className="num">3</span>{'\n'}
              {'})'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────── */}
      <div className="stats-strip" ref={statsRef}>
        <div className="container">
          <div className="stats-flex">
            <div className="stat-item">
              <span className="stat-num">{stats.throughput.toLocaleString()}</span>
              <span className="stat-label">Jobs / sec peak</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">&lt; 4ms</span>
              <span className="stat-label">p99 dispatch latency</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{stats.reliability.toFixed(2)}%</span>
              <span className="stat-label">Delivery reliability</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">3</span>
              <span className="stat-label">Redis primitives</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Features ─────────────────────────── */}
      <section id="features" className="section container">
        <div className="section-label">Why Distri</div>
        <h2>Everything a production queue needs.</h2>
        <p className="section-sub">
          No magic. No proprietary protocol. Just primitives you understand, composed into a production-grade system.
        </p>
        <div className="features-grid">
          {features.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────── */}
      <section id="how" className="section-sm container">
        <div className="section-label">Getting Started</div>
        <h2>Three steps to production.</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h3>Install the SDK</h3>
            <p><code>npm install distri-task-sdk</code><br />Redis connection is the only prerequisite.</p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3>Enqueue from your producer</h3>
            <p>Call <code>queue.enqueue()</code> with a type, payload, priority, and retry policy.</p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3>Workers process with retries</h3>
            <p>Register handlers via <code>pool.register()</code>. Workers auto-restart on failure.</p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────── */}
      <div className="container">
        <div className="cta-banner">
          <h2>Ready to ship reliable background jobs?</h2>
          <p>Open source. Redis-native. No paid infra required.</p>
          <Link to="/dashboard">
            <button className="btn-white">Open Dashboard →</button>
          </Link>
        </div>
      </div>

      {/* ── Footer ───────────────────────────── */}
      <footer>
        <div className="container footer-inner">
          <div className="footer-logo">DISTRI</div>
          <div className="footer-links">
            <a href="https://github.com/Garrur/Distri_sys" target="_blank" rel="noreferrer">GitHub</a>
            <a href="#">NPM</a>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--l-subtle)' }}>
            MIT License — Built by Utkarsh Raj, IIT Patna
          </div>
        </div>
      </footer>
    </div>
  );
}
