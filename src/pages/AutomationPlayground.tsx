import { useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAutomations } from '@/hooks/useAutomations'
import { useFlowAutomations } from '@/hooks/useFlowAutomations'
import { useAutomationPlayground, SimulationConfig } from '@/hooks/useAutomationPlayground'
import { PlaygroundConfigPanel } from '@/components/automations/playground/PlaygroundConfigPanel'
import { PlaygroundTimeline } from '@/components/automations/playground/PlaygroundTimeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, Play, Square, RotateCcw, AlertTriangle } from 'lucide-react'

const DEFAULT_CONFIG: SimulationConfig = {
  trigger_type: 'message_received',
  customer: { name: 'João Silva', phone: '+5511999999999', email: 'joao@example.com' },
  message: 'Olá, preciso de ajuda com meu pedido',
  sentiment: 'neutral',
  urgency: 'medium',
  custom_variables: {},
}

export default function AutomationPlayground() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isFlow = location.pathname.startsWith('/flow-builder')

  const { automations, isLoading: isLoadingAutomations } = useAutomations()
  const { flows, isLoading: isLoadingFlows } = useFlowAutomations()

  const isLoading = isFlow ? isLoadingFlows : isLoadingAutomations

  const item = useMemo(() => {
    if (isFlow) return flows?.find(f => f.id === id)
    return automations?.find(a => a.id === id)
  }, [isFlow, flows, automations, id])

  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG)
  const [hasExecuted, setHasExecuted] = useState(false)

  const { steps, isRunning, metrics, resolvedVars, simulateNoCode, simulateFlow, resetSimulation } = useAutomationPlayground()

  const handleExecute = async () => {
    if (!item) return
    setHasExecuted(true)
    if (isFlow) {
      await simulateFlow(item, config)
    } else {
      await simulateNoCode(item, config)
    }
  }

  const handleReset = () => {
    resetSimulation()
    setHasExecuted(false)
  }

  const itemName = item ? ('name' in item ? (item as any).name : 'Automação') : 'Carregando...'
  const realTriggerType = item ? ('trigger_type' in item ? (item as any).trigger_type : undefined) : undefined

  const backPath = isFlow ? '/flow-builder' : '/automations'

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950 -m-6">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 -m-6 gap-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <p className="text-slate-300 text-lg">{isFlow ? 'Fluxo' : 'Automação'} não encontrado</p>
        <Button variant="outline" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 -m-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)} className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100">{itemName}</h1>
              <Badge variant="outline" className="text-xs border-slate-600">
                {isFlow ? '🔀 Flow Visual' : '⚡ No-Code'}
              </Badge>
            </div>
          </div>
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 ml-2">
            SIMULAÇÃO SEGURA — SEM EFEITOS REAIS
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isRunning} className="border-slate-600 text-slate-300">
            <RotateCcw className="w-4 h-4 mr-1" /> Limpar
          </Button>
          {isRunning ? (
            <Button size="sm" variant="destructive" onClick={resetSimulation}>
              <Square className="w-4 h-4 mr-1" /> Executando...
            </Button>
          ) : (
            <Button size="sm" onClick={handleExecute} disabled={!item} className="bg-[#45E5E5] text-slate-900 hover:bg-[#38cccc]">
              <Play className="w-4 h-4 mr-1" /> Executar Simulação
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
        <PlaygroundConfigPanel
          config={config}
          onChange={setConfig}
          realTriggerType={realTriggerType}
          resolvedVars={resolvedVars}
          hasExecuted={hasExecuted}
        />
        <PlaygroundTimeline steps={steps} metrics={metrics} />
      </div>
    </div>
  )
}
