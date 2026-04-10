import { cn } from '@/lib/utils'
import { WarningBox } from './WarningBox'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface Step {
  number?: number
  title: string
  description: React.ReactNode
  warning?: string
  action?: {
    label: string
    href: string
  }
}

interface StepByStepProps {
  steps: Step[]
  className?: string
}

export function StepByStep({ steps, className }: StepByStepProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          {/* Connector line */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
              {step.number ?? i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-0.5 flex-1 bg-border my-1 min-h-[16px]" />
            )}
          </div>

          {/* Content */}
          <div className={cn('flex-1 pb-6', i === steps.length - 1 && 'pb-0')}>
            <h4 className="font-semibold text-foreground text-sm mb-1 mt-1">{step.title}</h4>
            <div className="text-sm text-muted-foreground leading-relaxed">{step.description}</div>
            {step.warning && (
              <WarningBox type="warning" className="mt-3">
                {step.warning}
              </WarningBox>
            )}
            {step.action && (
              <a href={step.action.href} className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="gap-1.5">
                  {step.action.label}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
