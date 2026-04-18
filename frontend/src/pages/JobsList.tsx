import { useEffect, useState } from 'react';

interface Job {
  id: string; type: string; data: any; status: string;
  priority: string; attempts: number; maxAttempts: number; createdAt: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: 'var(--green-bg)',  color: '#059669',       label: 'Completed' },
  active:    { bg: 'var(--teal-bg)',   color: 'var(--teal)',   label: 'Active'    },
  waiting:   { bg: 'var(--surface-2)', color: 'var(--muted)',  label: 'Waiting'   },
  delayed:   { bg: 'var(--amber-bg)',  color: '#d97706',       label: 'Delayed'   },
  failed:    { bg: 'var(--red-bg)',    color: 'var(--red)',    label: 'Failed'    },
  dead:      { bg: 'var(--red-bg)',    color: '#b91c1c',       label: 'Dead'      },
  high:      { bg: 'var(--teal-bg)',   color: 'var(--teal)',   label: 'High'      },
  low:       { bg: 'var(--surface-2)', color: 'var(--subtle)', label: 'Low'       },
};

const statusOptions = ['high', 'waiting', 'low', 'delayed', 'failed', 'dead'];

export default function JobsList() {
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [filter, setFilter]   = useState('waiting');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/jobs?status=${filter}&limit=20`);
        if (!r.ok) throw new Error();
        setJobs((await r.json()).jobs ?? []);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetch_();
    const id = setInterval(fetch_, 3000);
    return () => clearInterval(id);
  }, [filter]);

  const handleRetry   = async (id: string) => { try { await fetch(`${API_URL}/jobs/${id}/retry`, { method: 'POST' }); } catch {} };
  const handleTestJob = async ()            => { try { await fetch(`${API_URL}/jobs/test`,        { method: 'POST' }); } catch {} };

  const badge = (s: string) => STATUS_BADGE[s] ?? STATUS_BADGE.waiting;

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* ── Header ───────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Task Register</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>Chronological audit log of all node executions</p>
        </div>
        <button className="btn-morphic" onClick={handleTestJob}>+ Inject Task</button>
      </div>

      {/* ── Filter tabs ──────────────────────── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: '1.5rem',
        background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
        padding: 4, width: 'fit-content', border: '1px solid var(--border)',
      }}>
        {statusOptions.map(s => {
          const b = badge(s);
          const active = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', border: 'none', borderRadius: 8,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
              fontWeight: active ? 600 : 400,
              fontSize: '0.82rem', cursor: 'pointer',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color, display: 'inline-block' }} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          );
        })}
      </div>

      {/* ── Table container ──────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px minmax(160px,1fr) 1fr 130px 110px 100px 90px',
          gap: '1rem', padding: '10px 20px',
          background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
          fontSize: '0.72rem', fontWeight: 700, color: 'var(--subtle)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {['#', 'Job Type', 'Payload', 'Time', 'Priority', 'Status', ''].map(c => <span key={c}>{c}</span>)}
        </div>

        {loading && jobs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Syncing records...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📭</div>
            The <strong>{filter}</strong> register is empty.
          </div>
        ) : (
          jobs.map((job, i) => {
            const b = badge(job.status);
            return (
              <div key={job.id} style={{
                display: 'grid',
                gridTemplateColumns: '36px minmax(160px,1fr) 1fr 130px 110px 100px 90px',
                gap: '1rem', padding: '12px 20px', alignItems: 'center',
                borderBottom: i < jobs.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Index */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--subtle)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Job type + id */}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.type}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--subtle)', marginTop: 2 }}>
                    {job.id.substring(0, 14)}…
                  </div>
                </div>

                {/* Payload */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {JSON.stringify(job.data).substring(0, 32)}
                </span>

                {/* Time */}
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {new Date(job.createdAt).toLocaleTimeString()}
                </span>

                {/* Priority badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 10px', borderRadius: '999px',
                  fontSize: '0.72rem', fontWeight: 600,
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  width: 'fit-content',
                }}>
                  {job.priority}
                </span>

                {/* Status badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: '999px',
                  fontSize: '0.72rem', fontWeight: 600,
                  background: b.bg, color: b.color,
                  width: 'fit-content',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.color }} />
                  {b.label}
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>  {job.attempts}/{job.maxAttempts}</span>
                </span>

                {/* Retry */}
                <div>
                  {(job.status === 'dead' || job.status === 'failed') && (
                    <button onClick={() => handleRetry(job.id)} style={{
                      padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)', color: 'var(--text-2)',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--teal)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--teal)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
                    >
                      ↺ Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
