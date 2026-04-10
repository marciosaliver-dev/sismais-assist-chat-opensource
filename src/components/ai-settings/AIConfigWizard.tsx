import { useState } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, Wifi, Cpu, Users, Bot, CheckCircle2 } from 'lucide-react'
import { WizardStepper, type WizardStep } from './wizard/WizardStepper'
import { WizardStepProvider } from './wizard/WizardStepProvider'
import { WizardStepEngine } from './wizard/WizardStepEngine'
import { WizardStepSquads } from './wizard/WizardStepSquads'
import { WizardStepAgents } from './wizard/WizardStepAgents'
import { WizardStepReview } from './wizard/WizardStepReview'

const WIZARD_STEPS: WizardStep[] = [
  { id: 'provider', title: 'Provider', description: 'Créditos e conexão', icon: Wifi },
  { id: 'engine', title: 'Motor Interno', description: 'IAs do sistema', icon: Cpu },
  { id: 'squads', title: 'Squads', description: 'Padrões por especialidade', icon: Users },
  { id: 'agents', title: 'Agentes', description: 'Resumo dos agentes', icon: Bot },
  { id: 'review', title: 'Revisar', description: 'Verificar e concluir', icon: CheckCircle2 },
]

const STEP_COMPONENTS = [
  WizardStepProvider,
  WizardStepEngine,
  WizardStepSquads,
  WizardStepAgents,
  WizardStepReview,
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AIConfigWizard({ open, onOpenChange }: Props) {
  const [currentStep, setCurrentStep] = useState(0)

  const StepComponent = STEP_COMPONENTS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === WIZARD_STEPS.length - 1

  const handleClose = () => {
    onOpenChange(false)
    setCurrentStep(0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Configuração Centralizada de IA</h2>
            <p className="text-xs text-muted-foreground">Configure todo o motor de IA em um só lugar</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Stepper sidebar */}
          <WizardStepper
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />

          {/* Step content */}
          <div className="flex-1 overflow-y-auto p-6">
            <StepComponent />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 bg-muted/30">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={isFirst}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            {isLast ? (
              <Button
                size="sm"
                onClick={handleClose}
                className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Concluir
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setCurrentStep(s => s + 1)}
                className="bg-[#10293F] text-white hover:bg-[#1a3d5c]"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
