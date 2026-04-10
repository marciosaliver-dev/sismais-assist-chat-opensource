import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { SimulationConfig } from '@/hooks/useAutomationPlayground'

interface ResolvedVariable {
  key: string
  value: string
}

interface PlaygroundConfigPanelProps {
  config: SimulationConfig
  onChange: (config: SimulationConfig) => void
  realTriggerType?: string
  resolvedVars: ResolvedVariable[]
  hasExecuted: boolean
}

const TRIGGER_OPTIONS = [
  { value: 'message_received', label: '📩 Mensagem Recebida' },
  { value: 'ticket_created', label: '🎫 Ticket Criado' },
  { value: 'status_changed', label: '🔄 Mudança de Status' },
  { value: 'stage_changed', label: '📋 Mudança de Etapa' },
  { value: 'conversation_closed', label: '✅ Atendimento Finalizado' },
  { value: 'conversation_reopened', label: '🔁 Atendimento Reaberto' },
  { value: 'agent_assigned', label: '👤 Agente Atribuído' },
  { value: 'tag_added', label: '🏷️ Tag Adicionada' },
  { value: 'priority_changed', label: '🔺 Prioridade Alterada' },
  { value: 'sla_breached', label: '⏰ SLA Violado' },
  { value: 'csat_received', label: '⭐ CSAT Recebido' },
  { value: 'no_response_timeout', label: '⏳ Timeout Sem Resposta' },
  { value: 'scheduled', label: '📅 Agendado (Cron)' },
  { value: 'webhook', label: '🔗 Webhook Externo' },
]

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: '😊 Positivo' },
  { value: 'neutral', label: '😐 Neutro' },
  { value: 'negative', label: '😟 Negativo' },
  { value: 'angry', label: '😡 Irritado' },
]

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

export function PlaygroundConfigPanel({ config, onChange, realTriggerType, resolvedVars, hasExecuted }: PlaygroundConfigPanelProps) {
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')

  const update = (partial: Partial<SimulationConfig>) => onChange({ ...config, ...partial })

  const addVariable = () => {
    if (!newVarKey.trim()) return
    update({ custom_variables: { ...config.custom_variables, [newVarKey.trim()]: newVarValue } })
    setNewVarKey('')
    setNewVarValue('')
  }

  const removeVariable = (key: string) => {
    const next = { ...config.custom_variables }
    delete next[key]
    update({ custom_variables: next })
  }

  const triggerMismatch = realTriggerType && config.trigger_type !== realTriggerType

  return (
    <div className="space-y-4 w-[420px] shrink-0 overflow-y-auto h-full pr-1 pb-4">
      {/* Trigger */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tipo de Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select value={config.trigger_type} onValueChange={v => update({ trigger_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {triggerMismatch && (
            <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 rounded-md p-2 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>O trigger selecionado difere do configurado na automação ({realTriggerType}). A simulação continuará mesmo assim.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Nome" value={config.customer.name} onChange={e => update({ customer: { ...config.customer, name: e.target.value } })} className="bg-slate-800 border-slate-600" />
          <Input placeholder="Telefone" value={config.customer.phone} onChange={e => update({ customer: { ...config.customer, phone: e.target.value } })} className="bg-slate-800 border-slate-600" />
          <Input placeholder="Email" value={config.customer.email} onChange={e => update({ customer: { ...config.customer, email: e.target.value } })} className="bg-slate-800 border-slate-600" />
        </CardContent>
      </Card>

      {/* Message & Context */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Mensagem e Contexto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Conteúdo da mensagem simulada..." value={config.message} onChange={e => update({ message: e.target.value })} className="bg-slate-800 border-slate-600 min-h-[80px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={config.sentiment} onValueChange={v => update({ sentiment: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Sentimento" /></SelectTrigger>
              <SelectContent>
                {SENTIMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={config.urgency} onValueChange={v => update({ urgency: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Urgência" /></SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Custom Variables */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Variáveis Customizadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Chave" value={newVarKey} onChange={e => setNewVarKey(e.target.value)} className="bg-slate-800 border-slate-600 flex-1" />
            <Input placeholder="Valor" value={newVarValue} onChange={e => setNewVarValue(e.target.value)} className="bg-slate-800 border-slate-600 flex-1" />
            <Button size="icon" variant="outline" onClick={addVariable} className="shrink-0 border-slate-600">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {Object.entries(config.custom_variables).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between bg-slate-800 rounded-md px-3 py-1.5 text-xs">
              <span><code className="text-[#45E5E5]">{`{${k}}`}</code> = {v}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeVariable(k)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resolved Variables (post-execution) */}
      {hasExecuted && resolvedVars.length > 0 && (
        <Card className="bg-slate-900 border-emerald-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Variáveis Resolvidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {resolvedVars.map(v => (
                <div key={v.key} className="flex items-center gap-2 text-xs">
                  <code className="text-[#45E5E5]">{`{${v.key}}`}</code>
                  <span className="text-slate-500">→</span>
                  <span className="text-slate-300 truncate">{v.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
