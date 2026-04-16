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

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>('waiting');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:3000/jobs?status=${filter}&limit=20`);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        setJobs(data.jobs || []);
      } catch (e) {
        console.error('Failed to fetch jobs');
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleRetry = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/jobs/${id}/retry`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const statusOptions = ['high', 'waiting', 'low', 'delayed', 'failed', 'dead'];

  return (
    <div style={{ maxWidth: '1200px' }}>
      <header style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '3rem' }}>
        <div>
          <h2 style={{ fontSize: '3.5rem', margin: 0, color: 'var(--text-main)', fontFamily: 'var(--font-serif)' }}>
            Task Register
          </h2>
          <p style={{ marginTop: '1.25rem', color: 'var(--text-muted)', fontWeight: 300, fontSize: '1.05rem' }}>
            Chronological log of pending and finalized operations.
          </p>
        </div>

        {/* Neumorphic Filter Navigation */}
        <nav style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          background: 'var(--bg-dark-light)', 
          padding: '0.5rem', 
          borderRadius: '16px',
          boxShadow: 'var(--shadow-neumorphic-out)'
        }}>
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? 'var(--bg-dark)' : 'transparent',
                border: '1px solid',
                borderColor: filter === s ? 'rgba(255,255,255,0.03)' : 'transparent',
                color: filter === s ? 'var(--text-main)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filter === s ? 'var(--shadow-neumorphic-in)' : 'none'
              }}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      {/* List Container - Glass Panel */}
      <div className="glass-panel" style={{ padding: '1rem' }}>
        {loading && jobs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>
            Synchronizing records...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-olive)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>
            The {filter} register is currently empty.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {jobs.map((job) => (
              <div key={job.id} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(250px, 1fr) 200px 150px 150px 150px',
                gap: '2rem',
                padding: '1.5rem 2rem',
                alignItems: 'center',
                background: 'rgba(232, 225, 217, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.01)',
                transition: 'background 0.3s'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ID: {job.id.substring(0,8)}...</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>{job.type}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Payload</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 300 }}>{JSON.stringify(job.data).substring(0, 30)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Timestamp</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 300 }}>{new Date(job.createdAt).toLocaleTimeString()}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>State</span>
                  <span style={{ 
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    color: job.status === 'dead' ? 'var(--accent-terra)' : job.status === 'completed' ? 'var(--accent-olive)' : 'var(--text-main)'
                  }}>
                    {job.status} <span style={{ opacity: 0.5, fontWeight: 300 }}>({job.attempts}/{job.maxAttempts})</span>
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {(job.status === 'dead' || job.status === 'failed') && (
                     <button
                       className="btn-morphic"
                       onClick={() => handleRetry(job.id)}
                     >
                       Retry
                     </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
