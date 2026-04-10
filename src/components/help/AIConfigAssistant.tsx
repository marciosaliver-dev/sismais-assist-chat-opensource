import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Send, Loader2, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const QUICK_ACTIONS = [
  'Como criar um Agente IA?',
  'Por que meu agente não responde?',
  'Como melhorar o roteamento?',
  'Como treinar a IA com artigos?',
]

async function fetchSystemContext() {
  const [agentsRes, automationsRes, flowsRes, kbRes] = await Promise.all([
    supabase.from('ai_agents').select('name, specialty, is_active').eq('is_active', true),
    supabase.from('ai_automations').select('name, is_active').eq('is_active', true),
    supabase.from('flow_automations').select('name, is_active').eq('is_active', true),
    supabase.from('ai_knowledge_base').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const agents = agentsRes.data ?? []
  const automations = automationsRes.data ?? []
  const flows = flowsRes.data ?? []
  const kbCount = kbRes.count ?? 0

  return {
    agents,
    automations,
    flows,
    kbCount,
  }
}

function buildSystemContext(ctx: Awaited<ReturnType<typeof fetchSystemContext>>): string {
  const agentList = ctx.agents.length > 0
    ? ctx.agents.map((a) => `"${a.name}" (${a.specialty})`).join(', ')
    : 'Nenhum agente ativo'

  const automationList = ctx.automations.length > 0
    ? ctx.automations.map((a) => `"${a.name}"`).join(', ')
    : 'Nenhuma automação ativa'

  const flowList = ctx.flows.length > 0
    ? ctx.flows.map((f) => `"${f.name}"`).join(', ')
    : 'Nenhum flow ativo'

  return `CONTEXTO ATUAL DO SISTEMA DO USUÁRIO:
- Agentes IA ativos (${ctx.agents.length}): ${agentList}
- Automações ativas (${ctx.automations.length}): ${automationList}
- Flows ativos (${ctx.flows.length}): ${flowList}
- Base de conhecimento: ${ctx.kbCount > 0 ? `${ctx.kbCount} artigos` : 'Vazia (0 artigos)'}

Você é o Assistente de Configuração do Sismais Helpdesk IA. Seu papel é ajudar administradores não-técnicos a configurar e usar o sistema de IA.

REGRAS:
1. Responda sempre em português brasileiro simples, sem termos técnicos desnecessários
2. Use o contexto acima para dar respostas específicas ao sistema deste usuário
3. Dê instruções com caminhos de navegação específicos (ex: "Vá em Agentes IA → clique em Editar")
4. Se identificar problema no contexto, aponte proativamente
5. Nunca invente funcionalidades que não existem
6. Seja conciso — responda em no máximo 3-4 parágrafos`
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Olá! Sou seu assistente de configuração. Analisei seu sistema e posso ajudar com qualquer dúvida sobre como configurar e treinar a IA. O que você precisa?',
}

export function AIConfigAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: systemContext } = useQuery({
    queryKey: ['ai-assistant-context'],
    queryFn: fetchSystemContext,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [messages])

  async function handleSend(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const systemPromptMsg: ChatMessage | null = systemContext
        ? { role: 'system', content: buildSystemContext(systemContext) }
        : null

      const apiMessages = [
        ...(systemPromptMsg ? [systemPromptMsg] : []),
        ...updatedMessages.filter((m) => m.role !== 'system'),
      ]

      const { data, error } = await supabase.functions.invoke('platform-ai-assistant', {
        body: {
          messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
          context: 'general',
        },
      })

      if (error) throw error

      const reply =
        data?.message ??
        data?.content ??
        data?.reply ??
        'Desculpe, não consegui processar sua pergunta. Tente novamente.'

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ocorreu um erro. Por favor, tente novamente.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Quick actions — only shown at start */}
      {messages.length === 1 && (
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Perguntas rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleSend(action)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.filter((m) => m.role !== 'system').map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2 items-start',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'
                )}
              >
                {msg.role === 'user' ? (
                  <User className="w-3 h-3 text-primary" />
                ) : (
                  <Bot className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua dúvida..."
            className="flex-1 h-8 text-xs"
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
