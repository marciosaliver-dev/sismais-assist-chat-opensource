import { cn } from '@/lib/utils'

interface HealthScoreRingProps {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const SIZES = {
  sm: { wh: 48, stroke: 4, r: 18, text: 'text-sm', label: 'text-[9px]' },
  md: { wh: 72, stroke: 5, r: 28, text: 'text-lg', label: 'text-[10px]' },
  lg: { wh: 96, stroke: 6, r: 38, text: 'text-2xl', label: 'text-xs' },
}

function getColor(score: number): string {
  if (score >= 80) return '#16A34A'
  if (score >= 50) return '#FFB800'
  return '#DC2626'
}

function getLabel(score: number): string {
  if (score >= 80) return 'Bom'
  if (score >= 50) return 'Médio'
  return 'Baixo'
}

export function HealthScoreRing({ score, size = 'md', label, className }: HealthScoreRingProps) {
  const s = SIZES[size]
  const center = s.wh / 2
  const circumference = 2 * Math.PI * s.r
  const value = score ?? 0
  const offset = circumference - (value / 100) * circumference
  const color = getColor(value)

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: s.wh, height: s.wh }}>
        <svg width={s.wh} height={s.wh} className="-rotate-90" role="img" aria-label={`Health score: ${score ?? 'indisponível'}`}>
          <circle
            cx={center}
            cy={center}
            r={s.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            className="text-border"
          />
          <circle
            cx={center}
            cy={center}
            r={s.r}
            fill="none"
            stroke={color}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', s.text)} style={{ color }}>
            {score != null ? score : '—'}
          </span>
        </div>
      </div>
      <span className={cn('text-muted-foreground font-medium', s.label)}>
        {label || (score != null ? getLabel(value) : 'N/A')}
      </span>
    </div>
  )
}
