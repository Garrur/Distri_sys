import { useEffect, useState } from 'react';

interface Job {
  id: string;
  type: string;
  data: any;
  status: string;
  priority: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--accent-success)',
  active:    'var(--accent-terra)',
  waiting:   'var(--text-muted)',
  delayed:   '#7a6a40',
  failed:    '#c0392b',
  dead:      'var(--accent-error)',
  high:      'var(--accent-terra)',
  low:       'var(--text-muted)',
};

export default function JobsList() {
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>('waiting');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API_URL}/jobs?status=${filter}&limit=20`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    fetchJobs();
    const id = setInterval(fetchJobs, 3000);
    return () => clearInterval(id);
  }, [filter]);

  const handleRetry   = async (id: string) => {
    try { await fetch(`${API_URL}/jobs/${id}/retry`, { method: 'POST' }); } catch {}
  };
  const handleTestJob = async () => {
    try { await fetch(`${API_URL}/jobs/test`,        { method: 'POST' }); } catch {}
  };

  const statusOptions = ['high', 'waiting', 'low', 'delayed', 'failed', 'dead'];

  return (
    <div style={{ maxWidth: '1200px' }}>

      {/* ── Header ──────────────────────────────── */}
      <header style={{ marginBottom: '3rem', borderBottom: '1px solid var(--border-main)', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-terra)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
              distri / task-audit
            </p>
            <h2 style={{ fontSize: '3rem', margin: 0, color: 'var(--text-main)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>
              Task Register
            </h2>
            <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', fontWeight: 300, fontSize: '1rem', fontFamily: 'var(--font-sans)' }}>
              Chronological audit log of pending and finalized node executions.
            </p>
          </div>
          <button className="btn-morphic" onClick={handleTestJob}>
            + Inject Task
          </button>
        </div>

        {/* ── Filter strip ────────────────────── */}
        <nav style={{ display: 'flex', gap: '0' }}>
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background:   filter === s ? 'var(--bg-dark-highest)' : 'transparent',
                border:       '1px solid var(--border-main)',
                borderLeft:   filter === s ? '3px solid var(--accent-terra)' : '1px solid var(--border-main)',
                borderRadius: 0,
                color:        filter === s ? 'var(--accent-terra)' : 'var(--text-muted)',
                fontFamily:   'var(--font-mono)',
                fontSize:     '0.75rem',
                textTransform:'uppercase',
                letterSpacing:'0.08em',
                padding:      '0.6rem 1.2rem',
                cursor:       'pointer',
                transition:   'all 0.15s ease',
                marginRight:  '-1px', /* Collapse borders */
              }}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Column Headers ─────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px minmax(180px,1fr) 200px 140px 130px 100px 90px',
        gap: '1rem',
        padding: '0.5rem 1.5rem',
        borderBottom: '1px solid var(--border-main)',
      }}>
        {['#', 'Job Type', 'Payload', 'Timestamp', 'Priority', 'State', ''].map(col => (
          <span key={col} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {col}
          </span>
        ))}
      </div>

      {/* ── List Container ─────────────────────── */}
      <div style={{ background: 'var(--border-faint)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {loading && jobs.length === 0 ? (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--bg-dark)' }}>
            {'>'} Synchronizing records...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--bg-dark)' }}>
            <span style={{ color: 'var(--accent-terra)' }}>{'>'}</span>
            <span style={{ color: 'var(--text-muted)' }}> {filter} register is empty.</span>
          </div>
        ) : (
          jobs.map((job, i) => (
            <div
              key={job.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px minmax(180px,1fr) 200px 140px 130px 100px 90px',
                gap: '1rem',
                padding: '1rem 1.5rem',
                alignItems: 'center',
                background: 'var(--bg-dark)',
                borderLeft: job.status === 'dead' || job.status === 'failed'
                  ? '3px solid var(--accent-error)'
                  : job.status === 'completed' ? '3px solid var(--accent-success)'
                  : '3px solid transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark-highest)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
            >
              {/* Index */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--border-main)' }}>
                {String(i + 1).padStart(3, '0')}
              </span>

              {/* Job Type + ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflow: 'hidden' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {job.type}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {job.id.substring(0, 12)}…
                </span>
              </div>

              {/* Payload */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {JSON.stringify(job.data).substring(0, 28)}
              </span>

              {/* Timestamp */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(job.createdAt).toLocaleTimeString()}
              </span>

              {/* Priority */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-secondary)', textTransform: 'uppercase' }}>
                {job.priority}
              </span>

              {/* Status */}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: STATUS_COLORS[job.status] ?? 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px', height: '6px',
                  background: STATUS_COLORS[job.status] ?? 'var(--text-main)',
                }} />
                {job.status}
                <span style={{ opacity: 0.4, fontWeight: 300, fontSize: '0.65rem' }}>
                  {job.attempts}/{job.maxAttempts}
                </span>
              </span>

              {/* Retry */}
              <div>
                {(job.status === 'dead' || job.status === 'failed') && (
                  <button
                    className="btn-morphic"
                    onClick={() => handleRetry(job.id)}
                    style={{ fontSize: '0.7rem', padding: '0.35rem 0.75rem' }}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
