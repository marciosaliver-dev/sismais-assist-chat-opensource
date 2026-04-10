import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { SendHorizonal, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/useAgentBuilder'

interface BuilderChatProps {
  messages: ChatMessage[]
  onSend: (msg: string) => void
  isGenerating: boolean
}

function renderMarkdown(text: string) {
  // Basic markdown: bold, bullet lists
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/\*\*(.*?)\*\*/g)
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    )
    // Bullet list
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <li key={i} className="ml-4 list-disc">{rendered.slice(1)}</li>
    }
    return <span key={i}>{rendered}<br /></span>
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-[#10293F] flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-[#45E5E5]" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
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
  )
}

export default function BuilderChat({ messages, onSend, isGenerating }: BuilderChatProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4 pt-4">
        <div className="space-y-1 pb-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-2 mb-4',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[#10293F] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-[#45E5E5]" />
                </div>
              )}
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-[#45E5E5] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#10293F]" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-[#10293F] text-white rounded-2xl rounded-br-sm'
                    : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'
                )}
              >
                {renderMarkdown(msg.content)}
              </div>
            </div>
          ))}
          {isGenerating && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Descreva o agente ou peça ajustes..."
            className="resize-none min-h-[40px] max-h-[96px] text-sm leading-relaxed py-2.5 focus-visible:ring-[#45E5E5] focus-visible:ring-offset-0"
            rows={1}
            disabled={isGenerating}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="h-10 w-10 bg-[#45E5E5] hover:bg-[#2ecece] text-[#10293F] flex-shrink-0"
            aria-label="Enviar mensagem"
          >
            <SendHorizonal className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  )
}
