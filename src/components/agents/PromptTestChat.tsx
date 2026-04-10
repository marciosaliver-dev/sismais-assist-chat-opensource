import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/integrations/supabase/client'
import { Send, Loader2, X, RotateCcw, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptTestChatProps {
  systemPrompt: string
  agentName: string
  agentId?: string
  onClose: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function PromptTestChat({ systemPrompt, agentName, agentId, onClose }: PromptTestChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      if (agentId) {
        // Usa o playground do agent-executor para teste real
        const { data, error } = await supabase.functions.invoke('agent-executor', {
          body: {
            agent_id: agentId,
            message_content: text,
            mode: 'playground',
            conversation_history: updatedMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
          },
        })

        if (error) throw error
        setMessages(prev => [...prev, { role: 'assistant', content: data?.message || 'Sem resposta' }])
      } else {
        // Fallback: simula com prompt direto (sem agente salvo)
        const { data, error } = await supabase.functions.invoke('copilot-suggest', {
          body: {
            pending_message: text,
            mode: 'generate',
            agent_context: {
              system_prompt: systemPrompt,
              name: agentName,
            },
          },
        })

        if (error) throw error
        setMessages(prev => [...prev, { role: 'assistant', content: data?.text || 'Sem resposta' }])
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setInput('')
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Testar Prompt</span>
          <Badge variant="outline" className="text-xs">Simulação</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reiniciar conversa">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[240px] p-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <Bot className="w-8 h-8 mb-2 opacity-30" />
            <p>Envie uma mensagem para testar o prompt</p>
            <p className="text-xs mt-1 opacity-60">O agente usará o prompt atual (sem salvar)</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-foreground/60" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem de teste..."
          className="text-sm h-8"
          disabled={loading}
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
