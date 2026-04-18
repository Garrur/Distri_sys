interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'teal' | 'red' | 'green' | 'amber' | 'default';
  trend?: string;
}

export default function MetricCard({ title, value, subtitle, accent = 'default', trend }: MetricCardProps) {
  const accentColors = {
    teal:    { text: 'var(--teal)',  bg: 'var(--teal-bg)',  dot: 'var(--teal)' },
    red:     { text: 'var(--red)',   bg: 'var(--red-bg)',   dot: 'var(--red)' },
    green:   { text: 'var(--green)', bg: 'var(--green-bg)', dot: 'var(--green)' },
    amber:   { text: 'var(--amber)', bg: 'var(--amber-bg)', dot: 'var(--amber)' },
    default: { text: 'var(--text)',  bg: 'transparent',     dot: 'var(--subtle)' },
  };
  const c = accentColors[accent];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
    >
      {/* Accent dot top-right */}
      {accent !== 'default' && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          width: 8, height: 8, borderRadius: '50%',
          background: c.dot,
          boxShadow: `0 0 0 3px ${c.bg}`,
        }} />
      )}

      <div style={{
        fontSize: '0.75rem', fontWeight: 600,
        color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {title}
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '2.25rem', fontWeight: 500,
        lineHeight: 1.1, letterSpacing: '-0.02em',
        color: accent !== 'default' ? c.text : 'var(--text)',
      }}>
        {value}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.8rem', color: 'var(--subtle)' }}>
          {subtitle}
        </div>
      )}

      {trend && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.75rem', fontWeight: 600,
          color: trend.startsWith('+') ? 'var(--green)' : 'var(--muted)',
          background: trend.startsWith('+') ? 'var(--green-bg)' : 'var(--surface-2)',
          borderRadius: '999px', padding: '2px 8px', width: 'fit-content',
        }}>
          {trend}
        </div>
      )}
    </div>
  );
}
