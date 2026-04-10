import { useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { PhaseIndicator } from './PhaseIndicator'
import { ChatBubble } from './ChatBubble'
import type { ChatMessage, BuilderPhase, BuilderState, BuilderMode } from '@/hooks/useAIBuilder'

interface Props {
  messages: ChatMessage[]
  phase: BuilderPhase
  mode: BuilderMode
  state: BuilderState
  error: string | null
  onSendMessage: (text: string) => void
}

const WELCOME: Record<BuilderMode, string> = {
  agent: 'Olá! Sou o Arquiteto de Agentes da Sismais. Vou te guiar na criação de um agente profissional com perguntas detalhadas para garantir a melhor configuração possível.\n\nDescreva o que você precisa — qual o objetivo principal deste agente?',
  skill: 'Olá! Vou te ajudar a criar uma skill profissional para seus agentes. Skills são habilidades modulares que podem ser atribuídas a múltiplos agentes.\n\nQual habilidade você quer criar?',
}

export function BuilderChat({ messages, phase, mode, state, error, onSendMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, state])

  useEffect(() => {
    if (state === 'chatting') textareaRef.current?.focus()
  }, [state])

  const handleSend = () => {
    const text = inputRef.current.trim()
    if (!text || state === 'loading') return
    onSendMessage(text)
    inputRef.current = ''
    if (textareaRef.current) textareaRef.current.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showInput = state === 'chatting' || state === 'idle'

  return (
    <div className="flex flex-col h-full">
      <PhaseIndicator phase={phase} mode={mode} />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed max-w-[85%]">
                <p className="whitespace-pre-wrap">{WELCOME[mode]}</p>
              </div>
            </div>
          )}

          {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}

          {state === 'loading' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Analisando...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showInput && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              onChange={e => { inputRef.current = e.target.value }}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? 'Descreva o que você precisa...' : 'Responda a pergunta da IA...'}
              rows={2}
              className="resize-none text-sm flex-1"
            />
            <Button size="icon" onClick={handleSend} disabled={state === 'loading'} className="h-9 w-9 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
