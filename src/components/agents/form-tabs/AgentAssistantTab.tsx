import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAgentAssistant } from '@/hooks/useAgentAssistant'
import { Send, Sparkles, Check, X, Loader2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'

interface AgentAssistantTabProps {
  agent?: Tables<'ai_agents'> | null
  formData: Record<string, any>
  supportConfig: Record<string, any>
  onChange: (updates: Record<string, any>) => void
  onSupportConfigChange: (updates: Record<string, any>) => void
}

export function AgentAssistantTab({ agent, formData, supportConfig, onChange, onSupportConfigChange }: AgentAssistantTabProps) {
  const { messages, isLoading, pendingChanges, sendMessage, analyzeAgent, clearChanges } = useAgentAssistant(formData, supportConfig)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const applyChanges = () => {
    const formUpdates: Record<string, any> = {}
    const supportUpdates: Record<string, any> = {}

    for (const change of pendingChanges) {
      if (change.field.startsWith('support_config.')) {
        const key = change.field.replace('support_config.', '')
        supportUpdates[key] = change.after
      } else {
        formUpdates[change.field] = change.after
      }
    }

    if (Object.keys(formUpdates).length > 0) onChange(formUpdates)
    if (Object.keys(supportUpdates).length > 0) onSupportConfigChange(supportUpdates)
    clearChanges()
  }

  return (
    <div className="flex flex-col h-[calc(90vh-180px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Assistente IA
          </h3>
          <p className="text-sm text-muted-foreground">
            Converse comigo para melhorar seu agente. Analiso o prompt, sugiro melhorias e aplico mudanças.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={analyzeAgent} disabled={isLoading}>
          <Wand2 className="w-4 h-4 mr-2" />
          Analisar Agente
        </Button>
      </div>

      <div className="flex-1 border rounded-lg bg-muted/20 p-4 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Olá! Sou o assistente de configuração de agentes.</p>
            <p className="text-sm mt-1">Clique em "Analisar Agente" ou me diga o que quer melhorar.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['Melhorar o prompt', 'Adicionar exemplos', 'Tornar mais empático', 'Melhorar saudação'].map(s => (
                <Button key={s} variant="outline" size="sm" onClick={() => sendMessage(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-lg px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.changes && msg.changes.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="text-xs font-medium opacity-70">Mudanças sugeridas:</p>
                    {msg.changes.map((c, i) => (
                      <div key={i} className="text-xs bg-muted/50 rounded p-2">
                        <Badge variant="outline" className="mb-1">{c.label}</Badge>
                        <div className="mt-1 text-destructive line-through truncate">{c.before?.slice(0, 80) || '(vazio)'}</div>
                        <div className="mt-1 text-green-600 truncate">{c.after?.slice(0, 80)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-lg px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingChanges.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 mt-2">
          <span className="text-sm font-medium">{pendingChanges.length} mudança(s) sugerida(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearChanges}>
              <X className="w-4 h-4 mr-1" /> Descartar
            </Button>
            <Button size="sm" onClick={applyChanges}>
              <Check className="w-4 h-4 mr-1" /> Aplicar Mudanças
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Quero que o agente seja mais empático quando o cliente reclama..."
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="shrink-0 h-auto">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
