import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sparkles, Send, Loader2, Bot, User, Wand2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  fieldUpdates?: Record<string, any>
}

interface AgentConfigCopilotProps {
  formData: Record<string, any>
  supportConfig: Record<string, any>
  onUpdateFormData: (updates: Record<string, any>) => void
  onUpdateSupportConfig: (updates: Record<string, any>) => void
}

const SPECIALTY_SUGGESTIONS: Record<string, string[]> = {
  triage: [
    'Gere um prompt de triagem eficiente',
    'Configure regras de roteamento',
    'Defina categorias de direcionamento',
  ],
  support: [
    'Gere um prompt de suporte técnico ERP',
    'Configure diagnóstico por módulo',
    'Defina regras de escalação técnica',
  ],
  financial: [
    'Gere um prompt para cobrança empática',
    'Configure limites de negociação',
    'Defina respostas para inadimplência',
  ],
  sales: [
    'Gere um prompt de qualificação BANT',
    'Configure pitch por segmento',
    'Defina fluxo de agendamento de demo',
  ],
  sdr: [
    'Gere um prompt de prospecção outbound',
    'Configure qualificação de leads',
    'Defina cadência de follow-up',
  ],
  copilot: [
    'Gere um prompt de copiloto interno',
    'Configure sugestões de resposta',
    'Defina alertas de SLA',
  ],
  analytics: [
    'Gere um prompt de análise de dados',
    'Configure relatórios automáticos',
    'Defina métricas de acompanhamento',
  ],
}

const DEFAULT_SUGGESTIONS = [
  'Preencha todos os campos automaticamente',
  'Melhore meu prompt atual',
  'Audite esta configuração',
]

export function AgentConfigCopilot({
  formData,
  supportConfig,
  onUpdateFormData,
  onUpdateSupportConfig,
}: AgentConfigCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Sou o copiloto de configuração de agentes. Posso preencher campos, gerar prompts profissionais, sugerir melhorias e auditar seu agente. O que deseja fazer?',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const suggestions = useMemo(() => {
    const specialty = formData.specialty || ''
    const specific = SPECIALTY_SUGGESTIONS[specialty] || []
    // Se o agente não tem prompt ainda, sugerir auto-preenchimento
    if (!formData.system_prompt) {
      return ['Preencha todos os campos automaticamente', ...specific.slice(0, 2)]
    }
    return specific.length > 0 ? specific : DEFAULT_SUGGESTIONS
  }, [formData.specialty, formData.system_prompt])

  const handleSend = async (messageOverride?: string) => {
    const userMessage = (messageOverride || input).trim()
    if (!userMessage || isLoading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const chatHistory = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      chatHistory.push({ role: 'user', content: userMessage })

      const { data, error } = await supabase.functions.invoke('platform-ai-assistant', {
        body: {
          messages: chatHistory,
          context: 'agent',
          currentConfig: {
            name: formData.name,
            specialty: formData.specialty,
            description: formData.description,
            system_prompt: formData.system_prompt,
            tone: formData.tone,
            language: formData.language,
            model: formData.model,
            temperature: formData.temperature,
            max_tokens: formData.max_tokens,
            rag_enabled: formData.rag_enabled,
            confidence_threshold: formData.confidence_threshold,
            channel_type: formData.channel_type,
            priority: formData.priority,
            is_active: formData.is_active,
            support_config: {
              companyName: supportConfig.companyName,
              companyDescription: supportConfig.companyDescription,
              productsServices: supportConfig.productsServices,
              greeting: supportConfig.greeting,
              style: supportConfig.style,
              restrictions: supportConfig.restrictions,
              escalationTriggers: supportConfig.escalationTriggers,
              escalationMessage: supportConfig.escalationMessage,
              standardResponses: supportConfig.standardResponses,
            },
          },
        },
      })

      if (error) throw new Error(error.message)

      const assistantMessage = data?.message || 'Desculpe, não consegui processar sua solicitação.'

      let appliedUpdates: Record<string, any> = {}
      if (data?.type === 'config' && data?.config) {
        appliedUpdates = data.config
      }

      if (Object.keys(appliedUpdates).length > 0) {
        const formFields: Record<string, any> = {}
        const configFields: Record<string, any> = {}

        const formKeys = ['name', 'description', 'specialty', 'system_prompt', 'tone', 'language', 'model', 'temperature', 'max_tokens', 'rag_enabled', 'confidence_threshold', 'priority']

        for (const [key, value] of Object.entries(appliedUpdates)) {
          if (formKeys.includes(key)) {
            formFields[key] = value
          } else {
            configFields[key] = value
          }
        }

        if (Object.keys(formFields).length > 0) {
          onUpdateFormData(formFields)
          toast.success(`${Object.keys(formFields).length} campo(s) atualizados`)
        }
        if (Object.keys(configFields).length > 0) {
          onUpdateSupportConfig(configFields)
          toast.success(`${Object.keys(configFields).length} configuração(ões) atualizadas`)
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        fieldUpdates: Object.keys(appliedUpdates).length > 0 ? appliedUpdates : undefined,
      }])

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erro: ${msg}. Tente novamente.`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Copiloto IA
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Copiloto de Configuração
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Assistente IA para configurar seu agente
            {formData.name ? ` — ${formData.name}` : ''}
            {formData.specialty ? ` (${formData.specialty})` : ''}
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.fieldUpdates && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium opacity-70">Campos atualizados:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(msg.fieldUpdates).map(key => (
                          <span key={key} className="text-xs bg-background/50 px-1.5 py-0.5 rounded">
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ex: Configure um agente de suporte técnico..."
              className="min-h-[60px] max-h-[120px] resize-none text-sm"
              disabled={isLoading}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="shrink-0 self-end h-10 w-10"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSend(suggestion)}
                disabled={isLoading}
                className="text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
