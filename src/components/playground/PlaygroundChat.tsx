import { useState, useRef, useEffect } from 'react'
import { Bot, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PlaygroundMessage } from '@/hooks/usePlaygroundSession'

const QUICK_MESSAGES = [
  'Olá, preciso de ajuda',
  'Quero cancelar minha assinatura',
  'Tenho uma cobrança indevida',
  'Meu pedido não chegou',
]

interface Props {
  messages: PlaygroundMessage[]
  sending: boolean
  onSend: (msg: string) => void
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-emerald-500/20 text-emerald-400' : pct >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
  return <span className={cn('text-xs px-2 py-0.5 rounded-full', color)}>{pct}%</span>
}

export default function PlaygroundChat({ messages, sending, onSend }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim()) {
        onSend(input.trim())
        setInput('')
      }
    }
  }

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim())
      setInput('')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
            <Bot className="w-12 h-12 opacity-30" />
            <p className="text-sm">Inicie uma conversa de teste com o agente</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {QUICK_MESSAGES.map(msg => (
                <button
                  key={msg}
                  onClick={() => onSend(msg)}
                  className="px-3 py-1.5 text-xs rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-[#45E5E5]/50 text-slate-300 transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[#45E5E5]" />
              </div>
            )}
            <div className={cn('max-w-[75%] space-y-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cn(
                'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-[#45E5E5] text-slate-950 rounded-br-md'
                  : 'bg-slate-800 text-slate-200 rounded-bl-md'
              )}>
                {msg.content}
              </div>
              {msg.role === 'assistant' && msg.metadata && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{msg.metadata.latency_ms}ms</Badge>
                  <ConfidenceBadge value={msg.metadata.confidence} />
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{msg.metadata.total_tokens} tok</Badge>
                  {msg.metadata.rag_sources.length > 0 && (
                    <Badge variant="outline" className="text-xs border-slate-700 text-blue-400">{msg.metadata.rag_sources.length} RAG</Badge>
                  )}
                  {msg.metadata.tools_used.length > 0 && (
                    <Badge variant="outline" className="text-xs border-slate-700 text-purple-400">{msg.metadata.tools_used.join(', ')}</Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-[#45E5E5]" />
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#45E5E5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#45E5E5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#45E5E5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem de teste..."
            className="min-h-[40px] max-h-[120px] resize-none bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-[#45E5E5] hover:bg-[#3ad4d4] text-slate-950 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
