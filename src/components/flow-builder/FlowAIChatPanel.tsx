import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Send, Loader2, Sparkles, Check, Trash2, Bot, User } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Node, Edge } from 'reactflow'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  flowResult?: {
    nodes: Node[]
    edges: Edge[]
    description: string
  }
  applied?: boolean
}

interface FlowAIChatPanelProps {
  onClose: () => void
  onApplyFlow: (nodes: Node[], edges: Edge[]) => void
  currentNodes: Node[]
  currentEdges: Edge[]
}

const QUICK_SUGGESTIONS = [
  'Fluxo de atendimento com triagem',
  'Resposta automática com RAG',
  'Escalonamento por urgência',
  'Atendimento multi-agente',
]

export function FlowAIChatPanel({ onClose, onApplyFlow, currentNodes, currentEdges }: FlowAIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }))

      const { data, error } = await supabase.functions.invoke('flow-ai-builder', {
        body: {
          message: text,
          messages: chatHistory,
          currentNodes: currentNodes.map(n => ({ id: n.id, type: n.type, data: n.data, position: n.position })),
          currentEdges: currentEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label })),
        },
      })

      if (error) throw error

      if (data.type === 'flow') {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.description,
          flowResult: {
            nodes: data.nodes,
            edges: data.edges.map((e: any) => ({ ...e, type: 'custom', animated: true })),
            description: data.description,
          },
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.error || 'Sem resposta' }])
      }
    } catch (err: any) {
      console.error('AI error:', err)
      toast.error('Erro ao comunicar com a IA')
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = (idx: number) => {
    const msg = messages[idx]
    if (!msg.flowResult) return
    onApplyFlow(msg.flowResult.nodes as Node[], msg.flowResult.edges as Edge[])
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, applied: true } : m))
    toast.success('Fluxo aplicado no canvas!')
  }

  const handleDiscard = (idx: number) => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, flowResult: undefined, content: m.content + ' (descartado)' } : m))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">IA Flow Builder</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Descreva o fluxo que deseja criar e a IA gerará automaticamente no canvas.
            </p>
            <div className="space-y-1.5">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                >
                  <Sparkles className="w-3 h-3 inline mr-1.5 text-primary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.flowResult && !msg.applied && (
                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/50">
                    <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleApply(idx)}>
                      <Check className="w-3 h-3 mr-1" /> Aplicar
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleDiscard(idx)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Descartar
                    </Button>
                  </div>
                )}

                {msg.applied && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Aplicado
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o fluxo..."
            className="min-h-[36px] max-h-[100px] text-xs resize-none"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
