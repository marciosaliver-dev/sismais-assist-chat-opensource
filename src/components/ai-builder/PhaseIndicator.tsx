import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface BuilderPhase {
  current: number
  label: string
  total: number
}

const AGENT_PHASES = ['Identidade', 'Comportamento', 'Conhecimento', 'Avançado']
const SKILL_PHASES = ['Definição', 'Instruções', 'Ativação']

interface Props {
  phase: BuilderPhase
  mode: 'agent' | 'skill'
}

export function PhaseIndicator({ phase, mode }: Props) {
  const labels = mode === 'agent' ? AGENT_PHASES : SKILL_PHASES

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
      {labels.map((label, i) => {
        const stepNum = i + 1
        const isDone = phase.current > stepNum
        const isCurrent = phase.current === stepNum

        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
              isDone && 'bg-[#45E5E5] text-[#10293F]',
              isCurrent && 'bg-[#10293F] text-white ring-2 ring-[#10293F]/20',
              !isDone && !isCurrent && 'bg-muted text-muted-foreground border border-border'
            )}>
              {isDone ? <Check className="w-3.5 h-3.5" /> : stepNum}
            </div>
            <span className={cn(
              'text-xs hidden sm:block',
              isCurrent && 'font-semibold text-foreground',
              isDone && 'text-[#16A34A]',
              !isDone && !isCurrent && 'text-muted-foreground'
            )}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className={cn(
                'h-px flex-1',
                isDone ? 'bg-[#45E5E5]' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
