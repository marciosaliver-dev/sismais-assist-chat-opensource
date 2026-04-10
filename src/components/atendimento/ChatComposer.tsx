import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Send, Sparkles, FileText, Wand2, Smile, Paperclip, Mic, Bold, Italic, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onSend: (text: string) => void
  customerName?: string
}

export function ChatComposer({ onSend, customerName }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }

  return (
    <div className="border-t border-[var(--gms-g200)] bg-white">
      {/* AI buttons row */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 justify-end">
        <button
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--gms-cyan)] text-[var(--gms-navy)] text-xs font-semibold hover:bg-[var(--gms-cyan-hover)] transition-colors"
          aria-label="Gerar resposta com IA"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gerar
        </button>
        <button
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors"
          aria-label="Ver contexto da conversa"
        >
          <FileText className="w-3.5 h-3.5" />
          Contexto
        </button>
        <button
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--gms-g200)] text-[var(--gms-g700)] text-xs font-medium hover:bg-[var(--gms-g100)] transition-colors"
          aria-label="Melhorar texto com IA"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Melhorar
        </button>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 pb-1">
        <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] hover:bg-[var(--gms-g100)] transition-colors" aria-label="Negrito">
          <Bold className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] hover:bg-[var(--gms-g100)] transition-colors" aria-label="Itálico">
          <Italic className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] hover:bg-[var(--gms-g100)] transition-colors" aria-label="Lista">
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 pb-2">
        <div className="flex-1 flex items-end gap-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={customerName ? `Responda para ${customerName}...` : 'Digite sua mensagem...'}
            className="flex-1 resize-none text-[13px] text-[var(--gms-g900)] placeholder:text-[var(--gms-g300)] outline-none bg-transparent min-h-[36px] max-h-[120px] py-2"
            rows={1}
          />
        </div>
        <div className="flex items-center gap-0.5 pb-1">
          <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] transition-colors" aria-label="Emoji">
            <Smile className="w-5 h-5" />
          </button>
          <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] transition-colors" aria-label="Anexar arquivo">
            <Paperclip className="w-5 h-5" />
          </button>
          <button className="p-1.5 rounded text-[var(--gms-g500)] hover:text-[var(--gms-g900)] transition-colors" aria-label="Gravar áudio">
            <Mic className="w-5 h-5" />
          </button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim()}
            className={cn(
              'ml-1 h-9 px-4 rounded-lg font-semibold text-[13px] gap-1.5',
              'bg-[var(--gms-cyan)] text-[var(--gms-navy)] hover:bg-[var(--gms-cyan-hover)]',
              'disabled:opacity-40',
            )}
            aria-label="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  )
}
