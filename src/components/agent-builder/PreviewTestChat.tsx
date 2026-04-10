import { useState, useRef, useEffect } from 'react'
import { X, SendHorizonal, User, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface TestMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface PreviewTestChatProps {
  agentId?: string
  config: AgentConfig
  onClose: () => void
}

export default function PreviewTestChat({ agentId, config, onClose }: PreviewTestChatProps) {
  const [messages, setMessages] = useState<TestMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: `Olá! Sou o agente **${config.name || 'em configuração'}**. Como posso ajudar?`,
  }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMsg: TestMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const { data, error } = await supabase.functions.invoke('agent-executor', {
        body: {
          mode: 'playground',
          agent_id: agentId,
          message_content: trimmed,
          conversation_history: history,
        }
      })
      if (error) throw new Error(error.message)

      const reply = data?.response || data?.message || 'Resposta não disponível.'
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: reply }])
    } catch (err) {
      toast.error('Erro no teste: ' + (err as Error).message)
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Erro ao obter resposta. Verifique se o agente foi salvo antes de testar.',
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#10293F] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: config.color || '#45E5E5' }}
          >
            {config.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="text-white text-sm font-medium">Testando como cliente</p>
            <p className="text-white/50 text-xs">{config.name || 'Agente sem nome'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
          aria-label="Fechar teste"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 pt-4 bg-muted/30">
        <div className="space-y-1 pb-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-2 mb-3',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {msg.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{ backgroundColor: config.color || '#10293F' }}
                >
                  {config.name?.charAt(0)?.toUpperCase() || <Bot className="w-3.5 h-3.5" />}
                </div>
              )}
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-[#45E5E5] flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-[#10293F]" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] px-3 py-2 text-sm rounded-2xl',
                  msg.role === 'user'
                    ? 'bg-[#10293F] text-white rounded-br-sm'
                    : 'bg-white border border-border text-foreground rounded-bl-sm shadow-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-end gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#10293F] flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-[#45E5E5]" />
              </div>
              <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-3 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 bg-background flex gap-2 flex-shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Digite uma mensagem de teste..."
          className="flex-1 text-sm h-9 focus-visible:ring-[#45E5E5] focus-visible:ring-offset-0"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="h-9 w-9 bg-[#45E5E5] hover:bg-[#2ecece] text-[#10293F] flex-shrink-0"
          aria-label="Enviar"
        >
          <SendHorizonal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
