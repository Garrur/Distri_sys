import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const mockLogs = [
  '<span class="log-time">[12:04:01]</span> <span class="log-worker">WORKER-3</span> <span class="log-id">job:a1b2</span> <span class="status-dequeued">DEQUEUED</span> type=email',
  '<span class="log-time">[12:04:01]</span> <span class="log-worker">WORKER-1</span> <span class="log-id">job:9f3c</span> <span class="status-completed">COMPLETED</span> 142ms',
  '<span class="log-time">[12:04:02]</span> <span class="log-worker">WORKER-2</span> <span class="log-id">job:7e1a</span> <span class="status-failed">FAILED</span> attempt=1/3',
  '<span class="log-time">[12:04:02]</span> <span class="log-worker">SCHEDULER</span> <span class="log-id">job:7e1a</span> <span class="status-retry">RETRY</span> delay=2000ms',
  '<span class="log-time">[12:04:04]</span> <span class="log-worker">WORKER-3</span> <span class="log-id">job:7e1a</span> <span class="status-completed">COMPLETED</span> 98ms attempt=2'
];

export default function Landing() {
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>(mockLogs.slice(0, 3));
  
  const [stats, setStats] = useState({
    throughput: 0,
    reliability: 0
  });

  const benchRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  
  // Terminal Logic
  useEffect(() => {
    let index = 3;
    const interval = setInterval(() => {
      setLogs(prev => {
        const next = [...prev, mockLogs[index % mockLogs.length]];
        if (next.length > 7) return next.slice(next.length - 7);
        return next;
      });
      index++;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install distri-task-sdk');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Intersection Observers
  useEffect(() => {
    const observerOptions = { threshold: 0.1 };
    const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
    
    // Stats counter
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          let startTimestamp: number | null = null;
          const duration = 2000;
          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const ease = easeOutQuart(progress);
            
            setStats({
              throughput: Math.floor(ease * 10847),
              reliability: ease * 99.97
            });
            
            if (progress < 1) window.requestAnimationFrame(step);
          };
          window.requestAnimationFrame(step);
          statObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    if (statsRef.current) statObserver.observe(statsRef.current);

    // Bench bar fill
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bars = entry.target.querySelectorAll('.benchmark-bar') as NodeListOf<HTMLElement>;
          bars.forEach(bar => {
            bar.style.width = bar.getAttribute('data-width') || '0%';
          });
          barObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    if (benchRef.current) barObserver.observe(benchRef.current);

    return () => {
      statObserver.disconnect();
      barObserver.disconnect();
    };
  }, []);

  return (
    <div className="landing-page">
      <nav>
        <div className="container nav-inner">
          <div className="logo">DISTRI</div>
          <div className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <a href="https://github.com/Garrur/Distri_sys" target="_blank" rel="noreferrer">GitHub</a>
            <a href="#architecture">Architecture</a>
          </div>
          <div className="status-indicator">
            <div className="dot"></div>
            Redis connected
          </div>
        </div>
      </nav>

      <main>
        <header className="hero container">
          <div className="hero-left">
            <span className="version-label">Open source infrastructure / v1.0.0</span>
            <h1>The task queue that does not hide what it does.</h1>
            <p className="hero-subtext">Priority queues. Exponential backoff. Dead letter queues. Stalled job recovery. Built on Redis primitives you already understand.</p>
            <div className="ctas">
              <button 
                className="cta-install" 
                onClick={handleCopy}
              >
                <span style={{ color: copied ? 'var(--landing-success)' : 'inherit' }}>
                  {copied ? 'Copied to clipboard' : 'npm install distri-task-sdk'}
                </span>
                {!copied && <span className="copy-icon">⎘</span>}
              </button>
              <Link to="/dashboard" className="cta-link">Boot the dashboard &rarr;</Link>
            </div>
          </div>
          <div className="hero-right">
            <div className="terminal-panel">
              <div className="terminal-title-bar">
                <div className="terminal-lights">
                  <div className="light red"></div>
                  <div className="light yellow"></div>
                  <div className="light green"></div>
                </div>
                <div className="terminal-title">distri — worker logs</div>
              </div>
              <div className="terminal-content">
                {logs.map((log, i) => (
                  <div 
                    key={i} 
                    className="log-line" 
                    style={{ animation: 'none', opacity: 1, transform: 'translateY(0)' }}
                    dangerouslySetInnerHTML={{ __html: log }} 
                  />
                ))}
                <div className="log-line"><span className="cursor"></span></div>
              </div>
            </div>
          </div>
        </header>

        <section className="section-small stats-bar" ref={statsRef}>
          <div className="container stats-flex">
            <div className="stat-item">
              <div className="stat-num-container"><span className="stat-num">{stats.throughput.toLocaleString()}</span></div>
              <span className="stat-label">jobs / sec peak throughput</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-num-container"><span className="stat-num">&lt; 4ms</span></div>
              <span className="stat-label">p99 dispatch latency</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-num-container"><span className="stat-num">{stats.reliability.toFixed(2)}%</span></div>
              <span className="stat-label">delivery reliability</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-num-container"><span className="stat-num">3</span></div>
              <span className="stat-label">Redis primitives</span>
            </div>
          </div>
        </section>

        <section id="architecture" className="section-large container">
          <div className="section-header">
            <h2>No magic. Just Redis.</h2>
          </div>
          
          <div className="arch-diagram">
            <div className="arch-row">
              <div className="arch-node-generic">Producer</div>
              <div className="arch-arrow-x"></div>
              <div className="arch-node-redis">
                <span className="arch-type">LIST</span> <span className="arch-key">queue:high</span>
              </div>
              <div className="arch-arrow-x"></div>
              <div className="arch-node-worker">Worker Pool</div>
              <div className="arch-arrow-x"></div>
              <div className="arch-node-generic">Completed</div>
            </div>
            
            <div className="arch-down-branch">
              <div className="arch-arrow-y"></div>
              <div className="arch-node-redis" style={{ marginBottom: '8px' }}>
                <span className="arch-type">HASH</span> <span className="arch-key">active_jobs</span>
              </div>
              <div className="arch-arrow-y">
                <span className="arch-pill">on failure</span>
              </div>
              <div className="arch-node-redis" style={{ marginBottom: '8px' }}>
                <span className="arch-type">ZSET</span> <span className="arch-key">delayed</span>
              </div>
              <div className="arch-arrow-y">
                <span className="arch-pill">max attempts</span>
              </div>
              <div className="arch-node-redis">
                <span className="arch-type">LIST</span> <span className="arch-key">dead_letter</span>
              </div>
            </div>
          </div>

          <div className="paragraphs">
            <p>We use Redis <code>LIST</code> structures for the primary waiting queues. This allows workers to use <code>BRPOP</code> for strictly ordered, blocking pops without the continuous polling overhead required by <code>ZSET</code>-only implementations. Priority is naturally enforced by checking the high list before the low list.</p>
            <p>Atomic state transitions are completely handled via Lua scripts executed exclusively on the Redis server. When a job moves from waiting to active, or when an idempotency key is set entirely, we execute without MULTI/EXEC locks, preventing TOCTOU race conditions globally.</p>
            <p>Job payloads and metadata are persisted structurally as a standard Redis <code>HASH</code>. This separates the ordering logic (Lists, Sets) from the data footprint. At scale, this prevents pipeline bloat and lets you inspect any task manually using standard <code>HGETALL</code> inspection commands natively.</p>
          </div>
        </section>

        <section className="section-large container">
          <div className="section-header">
            <h2>Three lines to integrate.</h2>
          </div>
          
          <div className="code-grid">
            <div className="code-panel">
              <div className="code-title-bar">producer.ts</div>
              <div className="code-content">
                <div className="code-lines">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                </div>
                <pre className="code-pre"><code><span className="keyword">import</span> {'{'} DistriQueue {'}'} <span className="keyword">from</span> <span className="string">'distri-task-sdk'</span>{'\n\n'}
<span className="keyword">const</span> queue = <span className="keyword">new</span> DistriQueue({'{'} redis {'}'}){'\n\n'}
<span className="keyword">await</span> queue.enqueue({'{'}{'\n'}
  <span className="prop">type</span>: <span className="string">'send-email'</span>,{'\n'}
  <span className="prop">data</span>: {'{'} to: <span className="string">'user@example.com'</span> {'}'},{'\n'}
  <span className="prop">priority</span>: <span className="string">'high'</span>,{'\n'}
  <span className="prop">maxAttempts</span>: 3{'\n'}
{'}'})</code></pre>
              </div>
            </div>

            <div className="code-panel">
              <div className="code-title-bar">worker.ts</div>
              <div className="code-content">
                <div className="code-lines">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                </div>
                <pre className="code-pre"><code><span className="keyword">const</span> pool = <span className="keyword">new</span> WorkerPool({'{'} concurrency: 10, redis {'}'}){'\n\n'}
pool.register(<span className="string">'send-email'</span>, <span className="keyword">async</span> (job) {'=>'} {'{'}{'\n'}
  <span className="keyword">await</span> sendEmail(job.data){'\n'}
{'}'}){'\n\n'}
<span className="keyword">await</span> pool.start(){'\n'}
<span className="comment">// Watching 10 concurrent sockets...</span></code></pre>
              </div>
            </div>
          </div>
          <p className="code-note">That is it. No configuration files. No daemon to run. Redis is your broker.</p>
        </section>

        <section className="container">
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-num">01</span>
              <h3>Priority without overhead</h3>
              <p>Three dedicated Redis lists. BRPOP checks left to right. High priority jobs are always dequeued first. Zero sorting cost natively attached to dispatcher routines.</p>
            </div>
            <div className="feature-card">
              <span className="feature-num">02</span>
              <h3>Failures are first-class</h3>
              <p>Exponential backoff with jitter. Dead letter queue after max attempts. Stalled job watchdog via heartbeat TTL. Every failure mode is handled, not ignored.</p>
            </div>
            <div className="feature-card">
              <span className="feature-num">03</span>
              <h3>You own your data</h3>
              <p>Every job is a Redis hash. Query it with any Redis client. No proprietary formats. No vendor lock-in. HGETALL job:id and you have everything exposed.</p>
            </div>
          </div>
        </section>

        <section className="section-medium benchmark-section" ref={benchRef}>
          <div className="container">
            <div className="section-header">
              <h2>Numbers from a laptop.</h2>
              <span className="code-note">(No cloud infra. No paid benchmark service.)</span>
            </div>

            <div className="chart">
              <div className="chart-row">
                <div className="chart-label">concurrency=1</div>
                <div className="chart-bar-bg">
                  <div className="chart-bar-fill benchmark-bar" data-width="11%"></div>
                </div>
                <span className="chart-value">1,200 jobs/sec</span>
              </div>
              <div className="chart-row">
                <div className="chart-label">concurrency=5</div>
                <div className="chart-bar-bg">
                  <div className="chart-bar-fill benchmark-bar" data-width="53%"></div>
                </div>
                <span className="chart-value">5,800 jobs/sec</span>
              </div>
              <div className="chart-row">
                <div className="chart-label">concurrency=10</div>
                <div className="chart-bar-bg">
                  <div className="chart-bar-fill benchmark-bar" data-width="100%"></div>
                </div>
                <span className="chart-value">10,847 jobs/sec</span>
              </div>
            </div>
            
            <div className="bench-metrics-bar">
              <span className="metric-pill">p50: 2ms</span>
              <span className="metric-pill">p95: 3.8ms</span>
              <span className="metric-pill">p99: 4.1ms</span>
            </div>
            <p className="bench-note">Measured on MacBook M2, Redis 7, Node.js 20, zero-work handlers.</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <div>DISTRI — Built by Utkarsh Raj, IIT Patna</div>
          <div className="footer-links">
            <a href="https://github.com/Garrur/Distri_sys" target="_blank" rel="noreferrer">GitHub</a>
            <a href="#">NPM</a>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div>MIT License</div>
        </div>
      </footer>
    </div>
  );
}
