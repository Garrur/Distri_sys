import { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';

interface StatsResponse {
  queues: {
    high: number;
    normal: number;
    low: number;
    delayed: number;
    dead: number;
  };
  metrics: {
    jobs_processed_total: number;
    jobs_failed_total: number;
    avg_processing_time_ms: number;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:3000/stats');
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        setStats(data);
      } catch (e) {
        console.error('Failed to fetch stats');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateTask = async () => {
    try {
      await fetch('http://localhost:3000/jobs/test', { method: 'POST' });
    } catch (e) {
      console.error('Failed to enqueue test job');
    }
  };

  if (loading && !stats) return <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Synchronizing Systems...</div>;
  if (!stats) return <div style={{ color: 'var(--accent-terra)' }}>Telemitry signal lost.</div>;

  return (
    <div style={{ maxWidth: '1200px', paddingBottom: '4rem' }}>
      <header style={{ marginBottom: '5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '3.5rem', margin: 0, color: 'var(--text-main)' }}>
            System Telemetry
          </h2>
          <p style={{ 
            marginTop: '1.25rem', 
            color: 'var(--text-muted)', 
            maxWidth: '600px',
            lineHeight: 1.7,
            fontSize: '1.05rem',
            fontWeight: 300
          }}>
            Real-time diagnostics tracking distributive performance thresholds, execution latency, and general structural integrity across the main event queue.
          </p>
        </div>
        
        <button 
          className="btn-morphic" 
          onClick={handleGenerateTask}
          style={{ marginTop: '1rem' }}
        >
          Generate Task
        </button>
      </header>

      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(12, 1fr)', 
        gap: '2.5rem',
        marginBottom: '6rem'
      }}>
        <div style={{ gridColumn: 'span 5' }}>
          <MetricCard 
            title="Succeeded Executions" 
            value={stats.metrics.jobs_processed_total} 
            subtitle="Total successful node computations" 
          />
        </div>
        <div style={{ gridColumn: 'span 4' }}>
          <MetricCard 
            title="Global Latency" 
            value={`${Math.round(stats.metrics.jobs_failed_total ? stats.metrics.avg_processing_time_ms : stats.metrics.avg_processing_time_ms)}ms`} 
            subtitle="Compute time average"
          />
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <MetricCard 
            title="System Faults" 
            value={stats.metrics.jobs_failed_total} 
            subtitle="Dead-letter routing"
            accent={stats.metrics.jobs_failed_total > 0 ? 'rust' : 'default'}
          />
        </div>
      </section>

      {/* Queue state table */}
      <section className="glass-panel" style={{ padding: '2.5rem' }}>
        <h3 style={{ 
          fontFamily: 'var(--font-sans)', 
          fontSize: '0.85rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em', 
          marginBottom: '2rem',
          color: 'var(--text-muted)'
        }}>
          Active Partitions
        </h3>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {Object.entries(stats.queues).map(([key, value]) => (
            <div key={key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(232, 225, 217, 0.02)',
              alignItems: 'center',
              boxShadow: 'var(--shadow-glass-inner)',
              border: '1px solid rgba(255,255,255,0.02)'
            }}>
              <span style={{ 
                fontFamily: 'var(--font-serif)', 
                fontSize: '1.5rem', 
                textTransform: 'capitalize',
                color: 'var(--text-main)'
              }}>
                {key} Queue
              </span>
              <span style={{ 
                fontFamily: 'var(--font-serif)', 
                fontSize: '2rem', 
                color: value > 0 && key === 'dead' ? 'var(--accent-terra)' : 'var(--text-main)' 
              }}>
                {String(value).padStart(3, '0')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
