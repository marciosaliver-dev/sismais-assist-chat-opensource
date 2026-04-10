import { Users, CheckCircle, Star, Clock } from 'lucide-react';

interface TVScoreboardProps {
  kpis: {
    totalWaiting: number;
    resolvedToday: number;
    avgCsatToday: number;
    avgResolutionSecondsToday: number;
  };
  isTVMode: boolean;
}

function formatResolutionTime(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getWaitingLevel(total: number): 'normal' | 'warn' | 'critical' {
  if (total > 10) return 'critical';
  if (total >= 5) return 'warn';
  return 'normal';
}

const pulseStyle = `
@keyframes scoreboard-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

export function TVScoreboard({ kpis, isTVMode }: TVScoreboardProps) {
  const level = getWaitingLevel(kpis.totalWaiting);

  const bgColor =
    level === 'critical'
      ? 'rgba(220,38,38,0.15)'
      : level === 'warn'
      ? 'rgba(255,184,0,0.15)'
      : '#10293F';

  const waitingColor =
    level === 'critical'
      ? '#DC2626'
      : level === 'warn'
      ? '#FFB800'
      : '#FFFFFF';

  const height = isTVMode ? 120 : 56;
  const numberSize = isTVMode ? 64 : 24;
  const labelSize = isTVMode ? 11 : 10;
  const iconSize = isTVMode ? 24 : 16;
  const paddingH = isTVMode ? 32 : 16;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    height,
    background: bgColor,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: `0 ${paddingH}px`,
    transition: 'background 0.4s ease',
  };

  const kpiStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: isTVMode ? 6 : 2,
    flex: 1,
  };

  const numberStyle = (color: string, pulse: boolean): React.CSSProperties => ({
    fontFamily: "'Poppins', 'Inter', system-ui, sans-serif",
    fontSize: numberSize,
    fontWeight: 700,
    color,
    lineHeight: 1,
    animation: pulse ? 'scoreboard-pulse 1.5s ease-in-out infinite' : 'none',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: labelSize,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  };

  const iconColor = 'rgba(255,255,255,0.4)';

  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: isTVMode ? 64 : 32,
    background: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  };

  return (
    <>
      <style>{pulseStyle}</style>
      <div style={containerStyle}>
        {/* Na Fila */}
        <div style={kpiStyle}>
          <Users size={iconSize} color={level === 'normal' ? iconColor : waitingColor} style={{ opacity: level === 'normal' ? 1 : 0.7 }} />
          <span style={numberStyle(waitingColor, level === 'critical')}>
            {kpis.totalWaiting}
          </span>
          <span style={labelStyle}>Na Fila</span>
        </div>

        <div style={dividerStyle} />

        {/* Resolvidos */}
        <div style={kpiStyle}>
          <CheckCircle size={iconSize} color={iconColor} />
          <span style={numberStyle('#FFFFFF', false)}>
            {kpis.resolvedToday}
          </span>
          <span style={labelStyle}>Resolvidos</span>
        </div>

        <div style={dividerStyle} />

        {/* CSAT */}
        <div style={kpiStyle}>
          <Star size={iconSize} color={iconColor} />
          <span style={numberStyle('#45E5E5', false)}>
            {kpis.avgCsatToday.toFixed(1)}
          </span>
          <span style={labelStyle}>CSAT</span>
        </div>

        <div style={dividerStyle} />

        {/* Tempo Médio */}
        <div style={kpiStyle}>
          <Clock size={iconSize} color={iconColor} />
          <span style={numberStyle('#FFFFFF', false)}>
            {formatResolutionTime(kpis.avgResolutionSecondsToday)}
          </span>
          <span style={labelStyle}>Tempo Médio</span>
        </div>
      </div>
    </>
  );
}
