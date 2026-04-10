import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Send, Paperclip, BookOpen, RefreshCw, Share2, Ticket,
  ThumbsUp, ThumbsDown, Headphones, PlayCircle, MessageCircle,
  Plus, ChevronRight,
} from 'lucide-react'
import { HelpHeader } from '@/components/help/HelpHeader'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  date: Date
  messages: ChatMessage[]
}

const WELCOME_SUGGESTIONS = [
  'Como cadastrar um novo cliente?',
  'Como emitir uma nota fiscal?',
  'Como configurar permissões de usuário?',
  'Como gerar relatórios financeiros?',
]

const SUGGESTED_MANUALS = [
  { title: 'Cadastro de Clientes', type: 'Manual' },
  { title: 'Emissão de NF-e', type: 'Manual' },
  { title: 'Configuração de Permissões', type: 'Manual' },
]

const SUGGESTED_VIDEOS = [
  { title: 'Primeiros passos no GMS', type: 'Vídeo' },
  { title: 'Gestão financeira básica', type: 'Vídeo' },
]

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const monthAgo = new Date(today.getTime() - 30 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Hoje', items: [] },
    { label: 'Esta semana', items: [] },
    { label: 'Este mês', items: [] },
    { label: 'Anteriores', items: [] },
  ]

  for (const c of conversations) {
    const d = c.date
    if (d >= today) groups[0].items.push(c)
    else if (d >= weekAgo) groups[1].items.push(c)
    else if (d >= monthAgo) groups[2].items.push(c)
    else groups[3].items.push(c)
  }

  return groups.filter((g) => g.items.length > 0)
}

export default function HelpAIChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [input])

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setInput('')
  }, [])

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: ChatMessage = { role: 'user', content: msg }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    // Create or update conversation
    let convId = activeConversationId
    if (!convId) {
      convId = generateId()
      const newConv: Conversation = {
        id: convId,
        title: msg.slice(0, 60),
        date: new Date(),
        messages: updatedMessages,
      }
      setConversations((prev) => [newConv, ...prev])
      setActiveConversationId(convId)
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: updatedMessages } : c))
      )
    }

    try {
      const { data, error } = await supabase.functions.invoke('platform-ai-assistant', {
        body: {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          context: 'help-center',
        },
      })

      if (error) throw error

      const reply =
        data?.message ??
        data?.content ??
        data?.reply ??
        'Desculpe, não consegui processar sua pergunta. Tente novamente.'

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply }
      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: finalMessages } : c))
      )
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Ocorreu um erro ao processar sua pergunta. Por favor, tente novamente ou abra um chamado.',
      }
      const finalMessages = [...updatedMessages, errorMsg]
      setMessages(finalMessages)
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: finalMessages } : c))
      )
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

  function selectConversation(conv: Conversation) {
    setActiveConversationId(conv.id)
    setMessages(conv.messages)
  }

  const groups = groupConversationsByDate(conversations)

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <HelpHeader />

      <div className="flex flex-1 min-h-0">
        {/* ===== LEFT SIDEBAR — Chat History ===== */}
        <aside className="w-[260px] shrink-0 bg-white border-r border-gms-g200 flex flex-col">
          <div className="p-4 border-b border-gms-g200">
            <h2 className="text-sm font-semibold text-gms-g900 mb-3">Assistente IA</h2>
            <button
              onClick={startNewConversation}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-gms-navy text-white text-[13px] font-semibold hover:bg-[#1a3d5c] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Conversa
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {groups.length === 0 && (
              <p className="text-xs text-gms-g500 text-center mt-8 px-4">
                Suas conversas aparecerão aqui.
              </p>
            )}
            {groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-semibold text-gms-g500 uppercase tracking-wider px-2 mb-1">
                  {group.label}
                </p>
                {group.items.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors mb-0.5',
                      conv.id === activeConversationId
                        ? 'bg-gms-cyan-light text-gms-navy font-medium'
                        : 'text-gms-g900 hover:bg-gms-g100'
                    )}
                  >
                    <span className="block truncate">{conv.title}</span>
                    <span className="text-[10px] text-gms-g500">
                      {conv.date.toLocaleDateString('pt-BR')}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* ===== CENTER — Chat Area ===== */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="h-14 shrink-0 bg-white border-b border-gms-g200 flex items-center px-4 gap-3">
            <div className="w-9 h-9 rounded-full bg-gms-navy flex items-center justify-center">
              <Bot className="w-5 h-5 text-gms-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gms-g900">GMS Assistente IA</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gms-ok" />
                <span className="text-[11px] text-gms-g500">Online agora</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewConversation}
                aria-label="Nova conversa"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gms-g500 hover:bg-gms-g100 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                aria-label="Compartilhar"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gms-g500 hover:bg-gms-g100 transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <Link
                to="/help/tickets/new"
                aria-label="Abrir chamado"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gms-g500 hover:bg-gms-g100 transition-colors"
              >
                <Ticket className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-gms-navy flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-gms-cyan" />
                </div>
                <h3 className="text-lg font-semibold text-gms-g900 font-display mb-1">
                  Olá! Sou o Assistente IA do GMS
                </h3>
                <p className="text-sm text-gms-g500 max-w-md mb-6">
                  Posso ajudar com dúvidas sobre o sistema, guiar você em processos e sugerir manuais relevantes.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {WELCOME_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="px-3 py-1.5 rounded-full border border-gms-g200 bg-white text-[13px] text-gms-g900 hover:border-gms-cyan hover:bg-gms-cyan-light transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex gap-3 items-start', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                {msg.role === 'assistant' ? (
                  <div className="w-8 h-8 rounded-full bg-gms-navy flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-gms-cyan" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gms-cyan flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-gms-navy">MS</span>
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[70%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-gms-navy text-white rounded-xl rounded-br-sm'
                      : 'bg-white border border-gms-g200 text-gms-g900 rounded-xl rounded-bl-sm'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-gms-navy flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-gms-cyan" />
                </div>
                <div className="bg-white border border-gms-g200 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gms-g300 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-gms-g300 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-gms-g300 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-gms-g200 bg-white px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta..."
              disabled={loading}
              rows={1}
              className="w-full resize-none border-2 border-gms-g200 rounded-xl px-4 py-2.5 text-sm text-gms-g900 placeholder:text-gms-g500 focus:border-gms-cyan focus:outline-none transition-colors"
            />
            <div className="flex items-center mt-2">
              <button
                aria-label="Anexar arquivo"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-gms-g500 hover:bg-gms-g100 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                Anexar
              </button>
              <button
                aria-label="Ver manuais"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-gms-g500 hover:bg-gms-g100 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Manuais
              </button>
              <div className="flex-1" />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gms-navy text-white text-[13px] font-semibold hover:bg-[#1a3d5c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </div>
            <p className="text-center text-[11px] text-gms-g500 mt-2">
              A IA pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </main>

        {/* ===== RIGHT SIDEBAR — Related Resources ===== */}
        <aside className="w-[280px] shrink-0 bg-white border-l border-gms-g200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gms-g200">
            <h3 className="text-sm font-semibold text-gms-g900">Recursos Relacionados</h3>
          </div>

          {/* Manuais sugeridos */}
          <div className="p-4">
            <p className="text-[11px] font-semibold text-gms-g500 uppercase tracking-wider mb-2">
              Manuais sugeridos
            </p>
            <div className="space-y-1">
              {SUGGESTED_MANUALS.map((item) => (
                <Link
                  key={item.title}
                  to="/help/manuals"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gms-g900 hover:bg-gms-g100 transition-colors group"
                >
                  <BookOpen className="w-4 h-4 text-gms-g500 shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gms-g300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          {/* Videos sugeridos */}
          <div className="px-4 pb-4">
            <p className="text-[11px] font-semibold text-gms-g500 uppercase tracking-wider mb-2">
              Videos sugeridos
            </p>
            <div className="space-y-1">
              {SUGGESTED_VIDEOS.map((item) => (
                <Link
                  key={item.title}
                  to="/help/videos"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gms-g900 hover:bg-gms-g100 transition-colors group"
                >
                  <PlayCircle className="w-4 h-4 text-gms-g500 shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gms-g300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mx-4 border-t border-gms-g200" />

          {/* Feedback */}
          <div className="p-4">
            <div className="rounded-lg border border-gms-g200 p-3">
              <p className="text-[13px] font-medium text-gms-g900 mb-2">A resposta foi útil?</p>
              <div className="flex gap-2">
                <button
                  aria-label="Resposta útil"
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border border-gms-g200 text-[12px] text-gms-g500 hover:border-gms-ok hover:text-gms-ok hover:bg-green-50 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Sim
                </button>
                <button
                  aria-label="Resposta não útil"
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border border-gms-g200 text-[12px] text-gms-g500 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Não
                </button>
              </div>
            </div>
          </div>

          {/* Chamado CTA */}
          <div className="px-4 pb-4">
            <Link
              to="/help/tickets/new"
              className="flex items-center gap-3 rounded-lg border border-gms-g200 p-3 hover:border-gms-cyan hover:bg-gms-cyan-light transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-gms-g100 flex items-center justify-center shrink-0 group-hover:bg-gms-cyan/20">
                <Headphones className="w-4 h-4 text-gms-g500 group-hover:text-gms-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gms-g900">IA não resolveu?</p>
                <p className="text-[11px] text-gms-g500">Abra um chamado com nossa equipe</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gms-g300 shrink-0" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
