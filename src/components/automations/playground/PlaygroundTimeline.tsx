import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Clock, Loader2, CheckCircle2, XCircle, SkipForward,
  ChevronDown, Play, Zap,
} from 'lucide-react'
import type { SimulationStep } from '@/hooks/useAutomationPlayground'

interface SimulationMetrics {
  total: number
  success: number
  error: number
  skipped: number
  total_time_ms: number
}

interface PlaygroundTimelineProps {
  steps: SimulationStep[]
  metrics: SimulationMetrics
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="w-4 h-4" />, color: 'bg-slate-600 text-slate-300', label: 'Pendente' },
  running: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Executando' },
  success: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Sucesso' },
  error: { icon: <XCircle className="w-4 h-4" />, color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Erro' },
  skipped: { icon: <SkipForward className="w-4 h-4" />, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Ignorado' },
}

const TYPE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  condition: 'Condição',
  send_message: 'Enviar Mensagem',
  wait: 'Aguardar',
  add_tag: 'Adicionar Tag',
  assign_agent: 'Atribuir Agente',
  http_request: 'Requisição HTTP',
  escalate_to_human: 'Escalar p/ Humano',
  ai_respond: 'Resposta IA',
  ai_response: 'Resposta IA',
  search_knowledge: 'Buscar Conhecimento',
  conclusion: 'Conclusão',
  delay: 'Aguardar',
  end: 'Fim',
  set_variable: 'Definir Variável',
  update_field: 'Atualizar Campo',
  assign_human: 'Atribuir Humano',
  assign_ai: 'Atribuir IA',
  switch: 'Switch',
  jump_to_flow: 'Ir para Fluxo',
}

function StepCard({ step }: { step: SimulationStep }) {
  const [inputOpen, setInputOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const statusCfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending

  return (
    <div className="relative pl-8 animate-fade-in">
      {/* Timeline dot */}
      <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center z-10">
        {statusCfg.icon}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{step.name}</span>
            <Badge variant="outline" className="text-xs border-slate-600">
              {TYPE_LABELS[step.type] || step.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {step.duration_ms > 0 && (
              <span className="text-xs text-slate-400">{step.duration_ms}ms</span>
            )}
            <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
          </div>
        </div>

        {step.error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{step.error}</p>
        )}

        {/* Input collapsible */}
        {step.input && Object.keys(step.input).length > 0 && (
          <Collapsible open={inputOpen} onOpenChange={setInputOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <ChevronDown className={`w-3 h-3 transition-transform ${inputOpen ? 'rotate-0' : '-rotate-90'}`} />
              Input
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs text-slate-400 bg-slate-900 rounded p-2 mt-1 overflow-x-auto max-h-40">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Output collapsible */}
        {step.output && Object.keys(step.output).length > 0 && (
          <Collapsible open={outputOpen} onOpenChange={setOutputOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <ChevronDown className={`w-3 h-3 transition-transform ${outputOpen ? 'rotate-0' : '-rotate-90'}`} />
              Output
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs text-emerald-300 bg-slate-900 rounded p-2 mt-1 overflow-x-auto max-h-40">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

export function PlaygroundTimeline({ steps, metrics }: PlaygroundTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <Play className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-300">Pronto para simular</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Configure os parâmetros à esquerda e clique em <strong>Executar Simulação</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
      {/* Summary bar */}
      {metrics.total > 0 && (
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#45E5E5]" />
            <span className="text-xs font-medium">{metrics.total} passos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs">{metrics.success} sucesso</span>
          </div>
          {metrics.error > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs">{metrics.error} erro</span>
            </div>
          )}
          <div className="ml-auto text-xs text-slate-400">
            {(metrics.total_time_ms / 1000).toFixed(1)}s total
          </div>
        </div>
      )}

      {/* Timeline with vertical line */}
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
        <div className="space-y-3">
          {steps.map(step => <StepCard key={step.id} step={step} />)}
        </div>
      </div>
    </div>
  )
}
