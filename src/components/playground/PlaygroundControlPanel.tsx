import { useState } from 'react'
import { Users, Settings, FileText, GitBranch, Crown } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PERSONAS, type Persona, type PlaygroundMessage } from '@/hooks/usePlaygroundSession'
import type { Tables } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>

interface Props {
  agent: Agent | null
  activePersona: Persona
  onPersonaChange: (p: Persona) => void
  messages: PlaygroundMessage[]
}

const sentimentEmoji: Record<string, string> = { neutral: '😐', angry: '😡', negative: '😞', positive: '😊' }

export default function PlaygroundControlPanel({ agent, activePersona, onPersonaChange, messages }: Props) {
  const [customMode, setCustomMode] = useState(false)
  const [custom, setCustom] = useState<Persona>({ id: 'custom', name: '', problem: '', sentiment: 'neutral', isVip: false })

  const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.metadata)

  return (
    <div className="w-[400px] border-l border-slate-800 bg-slate-900 flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="persona" className="flex flex-col h-full">
        <TabsList className="bg-slate-800 border-b border-slate-700 rounded-none h-10 w-full justify-start px-2 flex-shrink-0">
          <TabsTrigger value="persona" className="text-xs gap-1 data-[state=active]:bg-slate-700"><Users className="w-3 h-3" />Persona</TabsTrigger>
          <TabsTrigger value="config" className="text-xs gap-1 data-[state=active]:bg-slate-700"><Settings className="w-3 h-3" />Config</TabsTrigger>
          <TabsTrigger value="log" className="text-xs gap-1 data-[state=active]:bg-slate-700"><FileText className="w-3 h-3" />Log</TabsTrigger>
          <TabsTrigger value="decisions" className="text-xs gap-1 data-[state=active]:bg-slate-700"><GitBranch className="w-3 h-3" />Decisões</TabsTrigger>
        </TabsList>

        {/* PERSONA */}
        <TabsContent value="persona" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Persona personalizada</Label>
            <Switch checked={customMode} onCheckedChange={setCustomMode} />
          </div>

          {!customMode ? (
            <div className="space-y-2">
              {PERSONAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => onPersonaChange(p)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    activePersona.id === p.id
                      ? 'border-[#45E5E5]/50 bg-[#45E5E5]/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">{sentimentEmoji[p.sentiment]} {p.name}</span>
                    {p.isVip && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{p.problem}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label className="text-xs text-slate-400">Nome</Label><Input value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} className="bg-slate-800 border-slate-700 text-sm" /></div>
              <div><Label className="text-xs text-slate-400">Problema</Label><Input value={custom.problem} onChange={e => setCustom(c => ({ ...c, problem: e.target.value }))} className="bg-slate-800 border-slate-700 text-sm" /></div>
              <div>
                <Label className="text-xs text-slate-400">Sentimento</Label>
                <Select value={custom.sentiment} onValueChange={v => setCustom(c => ({ ...c, sentiment: v as Persona['sentiment'] }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">😐 Neutro</SelectItem>
                    <SelectItem value="angry">😡 Irritado</SelectItem>
                    <SelectItem value="negative">😞 Insatisfeito</SelectItem>
                    <SelectItem value="positive">😊 Positivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={custom.isVip} onCheckedChange={v => setCustom(c => ({ ...c, isVip: v }))} />
                <Label className="text-xs text-slate-400">Cliente VIP</Label>
              </div>
              <button
                onClick={() => onPersonaChange({ ...custom, id: 'custom' })}
                className="w-full py-2 text-xs rounded-lg bg-[#45E5E5] text-slate-950 font-medium hover:bg-[#3ad4d4]"
              >
                Aplicar Persona
              </button>
            </div>
          )}
        </TabsContent>

        {/* CONFIG */}
        <TabsContent value="config" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
          {agent ? (
            <>
              <InfoRow label="Nome" value={agent.name} />
              <InfoRow label="Especialidade" value={agent.specialty || '—'} />
              <InfoRow label="Modelo" value={agent.model || '—'} />
              <InfoRow label="Temperatura" value={String(agent.temperature ?? 0.3)} />
              <InfoRow label="Max Tokens" value={String(agent.max_tokens ?? 1000)} />
              <InfoRow label="RAG" value={agent.rag_enabled ? '✅ Habilitado' : '❌ Desabilitado'} />
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">System Prompt</p>
                <pre className="text-xs text-slate-300 bg-slate-800 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto scrollbar-thin">
                  {agent.system_prompt?.substring(0, 500) || '—'}
                  {(agent.system_prompt?.length || 0) > 500 && '...'}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Carregando configurações...</p>
          )}
        </TabsContent>

        {/* LOG */}
        <TabsContent value="log" className="flex-1 overflow-y-auto p-3 space-y-2 m-0">
          {assistantMsgs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Nenhuma resposta gerada ainda</p>
          ) : (
            assistantMsgs.map((msg, i) => (
              <div key={msg.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Resposta #{i + 1}</span>
                  <span className="text-xs text-slate-500">{msg.metadata?.model_used}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Tokens" value={msg.metadata?.total_tokens || 0} />
                  <Stat label="Latência" value={`${msg.metadata?.latency_ms || 0}ms`} />
                  <Stat label="Confiança" value={`${Math.round((msg.metadata?.confidence || 0) * 100)}%`} />
                  <Stat label="Custo" value={`$${(msg.metadata?.cost_usd || 0).toFixed(5)}`} />
                  <Stat label="RAG Sources" value={msg.metadata?.rag_sources?.length || 0} />
                  <Stat label="Tools" value={msg.metadata?.tools_used?.length || 0} />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* DECISIONS */}
        <TabsContent value="decisions" className="flex-1 overflow-y-auto p-3 m-0">
          {assistantMsgs.some(m => m.metadata?.decision_path && m.metadata.decision_path.length > 0) ? (
            <div className="space-y-3">
              {assistantMsgs.filter(m => m.metadata?.decision_path?.length).map((msg, i) => (
                <div key={msg.id} className="space-y-1">
                  <p className="text-xs font-medium text-slate-300">Resposta #{i + 1}</p>
                  {msg.metadata?.decision_path.map((d, j) => (
                    <div key={j} className="flex gap-2 items-start pl-2 border-l-2 border-[#45E5E5]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#45E5E5] mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-300">{d.step}</p>
                        <p className="text-xs text-slate-500">{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <GitBranch className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm text-slate-500">Nenhum caminho de decisão disponível</p>
              <p className="text-xs text-slate-600">Os caminhos aparecem após o agente responder</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="text-xs font-medium text-slate-300">{String(value)}</p>
    </div>
  )
}
