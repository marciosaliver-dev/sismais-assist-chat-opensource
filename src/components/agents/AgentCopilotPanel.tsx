import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAgentAssistant } from '@/hooks/useAgentAssistant'
import { AgentPreviewCard } from './AgentPreviewCard'
import { Send, Sparkles, Check, X, Loader2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

const STEP_SUGGESTIONS: Record<string, string[]> = {
  profile: ['Sugerir nome para o agente', 'Qual especialidade combina com meu caso?'],
  behavior: ['Melhorar o prompt', 'Gerar saudação', 'Tornar mais empático'],
  model: ['Recomendar modelo ideal', 'Explicar temperatura'],
  rag: ['Configurar RAG para meu caso', 'Qual threshold usar?'],
  skills: ['Quais skills ativar?', 'Explicar function calling'],
  knowledge: ['Quais fontes preciso?', 'Como melhorar a base?'],
  policies: ['Sugerir horário de atendimento', 'Definir SLA'],
  guardrails: ['Configurar limites de segurança', 'Adicionar regra'],
  qa: ['Gerar exemplos de Q&A', 'Melhorar pares existentes'],
}

interface AgentCopilotPanelProps {
  agent?: Tables<'ai_agents'> | null
  formData: Partial<TablesInsert<'ai_agents'>>
  supportConfig: Record<string, any>
  activeStep: string
  onChange: (updates: Record<string, any>) => void
  onSupportConfigChange: (updates: Record<string, any>) => void
  onNavigate: (tabId: string) => void
}

export function AgentCopilotPanel({
  agent, formData, supportConfig, activeStep,
  onChange, onSupportConfigChange, onNavigate
}: AgentCopilotPanelProps) {
  const { messages, isLoading, pendingChanges, sendMessage, analyzeAgent, clearChanges } = useAgentAssistant(formData as Record<string, any>, supportConfig)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const applyChanges = () => {
    const formUpdates: Record<string, any> = {}
    const supportUpdates: Record<string, any> = {}
    for (const change of pendingChanges) {
      if (change.field.startsWith('support_config.')) {
        supportUpdates[change.field.replace('support_config.', '')] = change.after
      } else {
        formUpdates[change.field] = change.after
      }
    }
    if (Object.keys(formUpdates).length > 0) onChange(formUpdates)
    if (Object.keys(supportUpdates).length > 0) onSupportConfigChange(supportUpdates)
    clearChanges()
  }

  const suggestions = STEP_SUGGESTIONS[activeStep] || STEP_SUGGESTIONS.behavior

  return (
    <div className="w-[320px] border-l border-border shrink-0 flex flex-col bg-muted/10">
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">Copiloto IA</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={analyzeAgent} disabled={isLoading}>
            <Wand2 className="w-3 h-3 mr-1" /> Analisar
          </Button>
        </div>
        <AgentPreviewCard formData={formData} supportConfig={supportConfig} onNavigate={onNavigate} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
            <p className="text-xs text-muted-foreground mb-3">Me diga o que quer melhorar</p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map(s => (
                <Button key={s} variant="outline" size="sm" className="text-[11px] h-7 justify-start" onClick={() => sendMessage(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[90%] rounded-lg px-3 py-2 text-xs',
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border')}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.changes && msg.changes.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t pt-2">
                  {msg.changes.map((c, i) => (
                    <div key={i} className="bg-muted/50 rounded p-1.5">
                      <Badge variant="outline" className="text-[9px] mb-0.5">{c.label}</Badge>
                      <div className="text-destructive line-through truncate text-[10px]">{c.before?.slice(0, 60) || '(vazio)'}</div>
                      <div className="text-green-600 truncate text-[10px]">{c.after?.slice(0, 60)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-lg px-3 py-2"><Loader2 className="w-3 h-3 animate-spin" /></div>
          </div>
        )}
      </div>

      {pendingChanges.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border-t border-primary/20 px-3 py-1.5 shrink-0">
          <span className="text-[11px] font-medium">{pendingChanges.length} mudança(s)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={clearChanges}><X className="w-3 h-3 mr-0.5" /> Descartar</Button>
            <Button size="sm" className="h-6 text-[10px] px-2" onClick={applyChanges}><Check className="w-3 h-3 mr-0.5" /> Aplicar</Button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 p-2 border-t border-border shrink-0">
        <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Como posso ajudar?" className="min-h-[36px] max-h-[80px] resize-none text-xs" rows={1} />
        <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="shrink-0 h-9 w-9 p-0">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
