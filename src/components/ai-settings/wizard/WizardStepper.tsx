import { cn } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'

export interface WizardStep {
  id: string
  title: string
  description: string
  icon: React.ElementType
}

interface Props {
  steps: WizardStep[]
  currentStep: number
  onStepClick: (index: number) => void
}

export function WizardStepper({ steps, currentStep, onStepClick }: Props) {
  return (
    <div className="w-[240px] shrink-0 bg-[#10293F] text-white flex flex-col p-4 rounded-l-xl">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white/90">Configurar IA</h3>
        <p className="text-xs text-white/50 mt-0.5">Passo {currentStep + 1} de {steps.length}</p>
      </div>

      <nav className="flex-1 space-y-1">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index === currentStep
          const isDone = index < currentStep

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(index)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                isActive && 'bg-white/10',
                !isActive && !isDone && 'hover:bg-white/5',
                isDone && 'hover:bg-white/5'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all',
                isActive && 'bg-[#45E5E5] text-[#10293F]',
                isDone && 'bg-[#45E5E5]/20 text-[#45E5E5]',
                !isActive && !isDone && 'bg-white/10 text-white/40'
              )}>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  isActive && 'text-white',
                  isDone && 'text-white/70',
                  !isActive && !isDone && 'text-white/50'
                )}>
                  {step.title}
                </p>
                <p className={cn(
                  'text-xs truncate mt-0.5',
                  isActive ? 'text-white/60' : 'text-white/30'
                )}>
                  {step.description}
                </p>
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
