

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'rust' | 'olive' | 'gold' | 'default';
}

export default function MetricCard({ title, value, subtitle, accent = 'default' }: MetricCardProps) {
  const getAccentColor = () => {
    switch(accent) {
      case 'rust': return 'var(--accent-terra)';
      case 'olive': return 'var(--accent-olive)';
      case 'gold': return 'var(--accent-gold)';
      default: return 'var(--text-main)';
    }
  };

  return (
    <div className="glass-panel" style={{
      padding: '2.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Brutalist status indicator block instead of a glow */}
      {accent !== 'default' && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '12px',
          height: '12px',
          background: getAccentColor()
        }} />
      )}

      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-muted)'
      }}>
        {title}
      </div>
      
      <div style={{ marginTop: 'auto' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          fontSize: '3.5rem',
          lineHeight: '1',
          marginBottom: '0.75rem',
          color: getAccentColor()
        }}>
          {value}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            fontWeight: 300
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
