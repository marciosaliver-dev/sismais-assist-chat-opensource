import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { FlowStep } from './types'

interface Props {
  steps: FlowStep[]
}

export function FlowStepper({ steps }: Props) {
  const currentIdx = steps.findIndex(s => s.status === 'current')
  const total = steps.length

  return (
    <div
      role="progressbar"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label="Fluxo do atendimento"
      className="flex items-start gap-0"
    >
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start flex-1">
          <div className="flex flex-col items-center flex-1">
            {/* Dot */}
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 relative z-10',
                step.status === 'done' && 'bg-[var(--gms-cyan)] text-[var(--gms-navy)]',
                step.status === 'current' && 'bg-[var(--gms-navy)] text-white shadow-[0_0_0_3px_rgba(16,41,63,0.15)]',
                step.status === 'pending' && 'bg-[var(--gms-g200)] text-[var(--gms-g500)]',
              )}
            >
              {step.status === 'done' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </div>
            {/* Label */}
            <span
              className={cn(
                'text-[8px] mt-1.5 text-center leading-tight whitespace-nowrap',
                step.status === 'done' && 'text-[var(--gms-ok)] font-medium',
                step.status === 'current' && 'text-[var(--gms-navy)] font-semibold',
                step.status === 'pending' && 'text-[var(--gms-g500)]',
              )}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-[2px] flex-1 mt-3.5 -mx-1',
                i < currentIdx ? 'bg-[var(--gms-cyan)]' : 'bg-[var(--gms-g200)]',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
