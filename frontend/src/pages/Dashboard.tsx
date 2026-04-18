import { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';

interface StatsResponse {
  queues: { high: number; normal: number; low: number; delayed: number; dead: number; };
  metrics: { jobs_processed_total: number; jobs_failed_total: number; avg_processing_time_ms: number; };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const QUEUE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  high:    { label: 'High Priority',   color: 'var(--teal)',  dot: 'var(--teal)' },
  normal:  { label: 'Normal',          color: 'var(--text)',  dot: 'var(--subtle)' },
  low:     { label: 'Low Priority',    color: 'var(--muted)', dot: '#c4b5fd' },
  delayed: { label: 'Delayed',         color: 'var(--amber)', dot: 'var(--amber)' },
  dead:    { label: 'Dead Letter',     color: 'var(--red)',   dot: 'var(--red)' },
};

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch(`${API_URL}/stats`);
        if (!r.ok) throw new Error();
        setStats(await r.json());
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetch_();
    const id = setInterval(fetch_, 2000);
    return () => clearInterval(id);
  }, []);

  const handleGenerateTask = async () => {
    try { await fetch(`${API_URL}/jobs/test`, { method: 'POST' }); } catch { /* silent */ }
  };

  if (loading && !stats) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: '0.875rem' }}>
      <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Connecting to queue...
    </div>
  );

  if (!stats) return (
    <div style={{ color: 'var(--red)', fontSize: '0.875rem', padding: '1rem', background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca' }}>
      ⚠️  Could not reach the queue API. Check your connection.
    </div>
  );

  const totalQueued = Object.values(stats.queues).reduce((a, b) => a + b, 0);

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* ── Page header ────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            System Telemetry
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
            Real-time diagnostics across the distributed worker pool
          </p>
        </div>
        <button className="btn-morphic" onClick={handleGenerateTask}>
          + Generate Task
        </button>
      </div>

      {/* ── Metric cards ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard
          title="Succeeded"
          value={stats.metrics.jobs_processed_total.toLocaleString()}
          subtitle="Total completed jobs"
          accent="teal"
          trend="+12% today"
        />
        <MetricCard
          title="Avg Latency"
          value={`${Math.round(stats.metrics.avg_processing_time_ms)}ms`}
          subtitle="Processing time"
          accent="default"
        />
        <MetricCard
          title="System Faults"
          value={stats.metrics.jobs_failed_total}
          subtitle="Dead-letter routed"
          accent={stats.metrics.jobs_failed_total > 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="Queue Depth"
          value={totalQueued.toLocaleString()}
          subtitle="Jobs currently waiting"
          accent="amber"
        />
      </div>

      {/* ── Active Partitions ──────────────── */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>Active Partitions</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Live queue depth per priority tier</p>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--teal)', background: 'var(--teal-bg)', padding: '3px 10px', borderRadius: '999px', fontWeight: 600 }}>
            LIVE
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 120px 120px',
          padding: '8px 1.5rem',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          <span>Queue</span>
          <span style={{ textAlign: 'right' }}>Jobs</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        {/* Rows */}
        {Object.entries(stats.queues).map(([key, value], i) => {
          const cfg = QUEUE_CONFIG[key] ?? { label: key, color: 'var(--text)', dot: 'var(--subtle)' };
          const pct = totalQueued > 0 ? Math.round((value / totalQueued) * 100) : 0;
          return (
            <div key={key} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px',
              padding: '1rem 1.5rem',
              alignItems: 'center',
              borderBottom: i < Object.keys(stats.queues).length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.875rem', color: cfg.color }}>{cfg.label}</span>
                {pct > 0 && (
                  <div style={{ flex: 1, maxWidth: 200, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginLeft: 8 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: cfg.dot, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '0.95rem', color: value > 0 ? cfg.color : 'var(--subtle)' }}>
                {String(value).padStart(3, '0')}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: '0.72rem', fontWeight: 600,
                  padding: '3px 10px', borderRadius: '999px',
                  background: value > 0 ? (key === 'dead' ? 'var(--red-bg)' : key === 'delayed' ? 'var(--amber-bg)' : 'var(--teal-bg)') : 'var(--surface-2)',
                  color: value > 0 ? (key === 'dead' ? 'var(--red)' : key === 'delayed' ? 'var(--amber)' : 'var(--teal)') : 'var(--subtle)',
                }}>
                  {value > 0 ? (key === 'dead' ? '● Dead' : key === 'delayed' ? '● Pending' : '● Active') : '○ Empty'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
