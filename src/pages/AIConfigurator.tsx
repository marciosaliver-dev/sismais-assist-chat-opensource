import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Send, Paperclip, X, Bot, Sparkles, Zap, Webhook,
  RefreshCw, CheckCircle2, ChevronRight, ImageIcon,
  MessageSquare, Settings, BarChart3, FileText,
  Loader2, User, ArrowRight,
} from 'lucide-react'

type Context = 'general' | 'webhook' | 'automation'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string }; filename?: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string | ContentPart[]
  timestamp: Date
  config?: { tool: string; config: any }
  applied?: boolean
}

const CONTEXTS: { id: Context; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { id: 'general', label: 'Geral', icon: Sparkles, description: 'Configurar qualquer coisa', color: 'text-violet-500' },
  { id: 'webhook', label: 'Webhook', icon: Webhook, description: 'Integrações de entrada', color: 'text-orange-500' },
  { id: 'automation', label: 'Automação', icon: Zap, description: 'Regras e gatilhos', color: 'text-emerald-500' },
]

const QUICK_PROMPTS: Record<Context, string[]> = {
  general: [
    'Como funciona o sistema de agentes?',
    'Quais automações posso criar?',
    'Como conectar uma nova integração?',
  ],
  webhook: [
    'Configurar webhook do Asaas para cobranças',
    'Criar webhook de onboarding de novos clientes',
    'Integrar alertas de inadimplência',
  ],
  automation: [
    'Automação: mover ticket ao responder',
    'Automação: notificar agente em nova mensagem',
    'Automação: fechar conversa após resolução',
  ],
}

const TOOL_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  generate_agent_config: { label: 'Agente IA', icon: Bot, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  generate_webhook_config: { label: 'Webhook', icon: Webhook, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  generate_automation_config: { label: 'Automação', icon: Zap, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
}

// ── Apply config to Supabase ──────────────────────────────────────
async function applyConfig(tool: string, config: any): Promise<{ id?: string }> {
  if (tool === 'generate_webhook_config') {
    const payload = {
      name: config.name,
      description: config.description || null,
      template_type: config.template_type || 'custom',
      action_mode: config.action_mode || 'direct',
      actions: config.actions || [],
      field_mapping: config.field_mapping || {},
      is_active: true,
    }
    const { data, error } = await supabase.from('incoming_webhooks').insert(payload).select('id').single()
    if (error) throw error
    return { id: data?.id }
  }

  if (tool === 'generate_automation_config') {
    const payload = {
      name: config.name,
      description: config.description || null,
      trigger_type: config.trigger_type,
      trigger_conditions: config.trigger_conditions || {},
      actions: config.actions || [],
      is_active: true,
    }
    const { data, error } = await supabase.from('ai_automations').insert(payload).select('id').single()
    if (error) throw error
    return { id: data?.id }
  }

  throw new Error('Tipo de configuração desconhecido')
}

// ── Message display ───────────────────────────────────────────────
function MessageBubble({ msg, onApply }: { msg: ChatMessage; onApply: (msg: ChatMessage) => void }) {
  const isUser = msg.role === 'user'
  const [applying, setApplying] = useState(false)

  const textContent = typeof msg.content === 'string'
    ? msg.content
    : msg.content.filter(p => p.type === 'text').map(p => (p as any).text).join(' ')

  const imageParts = typeof msg.content === 'string'
    ? []
    : msg.content.filter(p => p.type === 'image_url') as ContentPart[]

  async function handleApply() {
    if (!msg.config) return
    setApplying(true)
    try {
      const { id } = await applyConfig(msg.config.tool, msg.config.config)
      onApply(msg)
      toast.success('Configuração aplicada com sucesso!', {
        description: id ? `ID: ${id.slice(0, 8)}...` : undefined,
      })
    } catch (e: any) {
      toast.error(`Erro ao aplicar: ${e.message}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-primary/20' : 'bg-violet-500/20'
      )}>
        {isUser
          ? <User className="w-4 h-4 text-primary" />
          : <Sparkles className="w-4 h-4 text-violet-500" />
        }
      </div>

      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser && 'items-end')}>
        {/* Image previews in user messages */}
        {imageParts.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imageParts.map((p, i) => (
              <img
                key={i}
                src={(p as any).image_url.url}
                alt="attachment"
                className="w-32 h-32 object-cover rounded-lg border border-border"
              />
            ))}
          </div>
        )}

        {/* Text bubble */}
        {textContent && (
          <div className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}>
            <p className="whitespace-pre-wrap">{textContent}</p>
          </div>
        )}

        {/* Config card */}
        {msg.config && (
          <ConfigCard
            config={msg.config}
            applied={msg.applied}
            applying={applying}
            onApply={handleApply}
          />
        )}

        <span className="text-xs text-muted-foreground px-1">
          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function ConfigCard({ config, applied, applying, onApply }: {
  config: { tool: string; config: any }
  applied?: boolean
  applying: boolean
  onApply: () => void
}) {
  const meta = TOOL_LABELS[config.tool] || { label: 'Configuração', icon: Settings, color: 'bg-muted text-foreground border-border' }
  const Icon = meta.icon
  const cfg = config.config

  const summary = [
    cfg.name && `Nome: ${cfg.name}`,
    cfg.specialty && `Especialidade: ${cfg.specialty}`,
    cfg.template_type && `Template: ${cfg.template_type}`,
    cfg.trigger_type && `Gatilho: ${cfg.trigger_type}`,
    cfg.tone && `Tom: ${cfg.tone}`,
    cfg.language && `Idioma: ${cfg.language}`,
  ].filter(Boolean).slice(0, 4)

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 min-w-[280px] max-w-sm bg-card', applied && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border', meta.color)}>
          <Icon className="w-3.5 h-3.5" />
          {meta.label} gerado
        </div>
        {applied && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aplicado
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        {summary.map((line, i) => (
          <p key={i} className="text-xs text-muted-foreground">{line}</p>
        ))}
      </div>

      {!applied && (
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={onApply}
          disabled={applying}
        >
          {applying
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aplicando...</>
            : <><CheckCircle2 className="w-3.5 h-3.5" /> Aplicar ao sistema</>
          }
        </Button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function AIConfigurator() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const rawContext = searchParams.get('context')

  // Agentes agora são criados exclusivamente no AI Builder
  useEffect(() => {
    if (rawContext === 'agent') {
      navigate('/ai-builder', { replace: true })
    }
  }, [rawContext, navigate])

  const initialContext = (rawContext as Context) || 'general'
  const validContext: Context = ['general', 'webhook', 'automation'].includes(initialContext)
    ? initialContext
    : 'general'
  const [context, setContext] = useState<Context>(validContext)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ContentPart[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset conversation when context changes
  useEffect(() => {
    setMessages([])
    setAttachments([])
    setInput('')
  }, [context])

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: apenas imagens são suportadas aqui`)
        return
      }
      if (file.size > 4 * 1024 * 1024) {
        toast.error(`${file.name}: máximo 4MB por imagem`)
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        const url = e.target?.result as string
        setAttachments(prev => [...prev, { type: 'image_url', image_url: { url }, filename: file.name } as any])
      }
      reader.readAsDataURL(file)
    })
  }

  const sendMessage = useCallback(async (promptOverride?: string) => {
    const text = (promptOverride || input).trim()
    if (!text && attachments.length === 0) return
    if (isLoading) return

    // Build user message content
    const userContent: ContentPart[] = []
    if (text) userContent.push({ type: 'text', text })
    userContent.push(...attachments)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent.length === 1 && userContent[0].type === 'text' ? text : userContent,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachments([])
    setIsLoading(true)

    // Build history for API (last 10 messages)
    const history = [...messages, userMsg].slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const { data, error } = await supabase.functions.invoke('platform-ai-assistant', {
        body: { messages: history, context },
      })

      if (error) throw error

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || 'Desculpe, não consegui processar.',
        timestamp: new Date(),
        config: data.type === 'config' ? { tool: data.tool, config: data.config } : undefined,
      }

      setMessages(prev => [...prev, aiMsg])


    } catch (e: any) {
      toast.error(`Erro: ${e.message}`)
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Ocorreu um erro ao processar sua mensagem. Tente novamente.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, attachments, messages, context, isLoading, qc])

  function markApplied(appliedMsg: ChatMessage) {
    setMessages(prev => prev.map(m => m.id === appliedMsg.id ? { ...m, applied: true } : m))
    qc.invalidateQueries({ queryKey: ['agents'] })
    qc.invalidateQueries({ queryKey: ['automations'] })
    qc.invalidateQueries({ queryKey: ['incoming-webhooks'] })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const quickPrompts = QUICK_PROMPTS[context]

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/20">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Configurador IA</p>
              <p className="text-xs text-muted-foreground">Configure via conversa</p>
            </div>
          </div>
        </div>

        {/* Context selector */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">Contexto</p>
          {CONTEXTS.map(ctx => {
            const Icon = ctx.icon
            return (
              <button
                key={ctx.id}
                onClick={() => setContext(ctx.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm',
                  context === ctx.id
                    ? 'bg-background border border-border shadow-sm'
                    : 'hover:bg-background/50'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', ctx.color)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-sm', context === ctx.id ? 'text-foreground' : 'text-muted-foreground')}>
                    {ctx.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{ctx.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <Separator />

        {/* Quick prompts */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">Sugestões</p>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-all border border-transparent hover:border-border"
            >
              <div className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                <span>{prompt}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Quick nav */}
        <div className="p-3 border-t border-border space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">Navegar</p>
          <button onClick={() => navigate('/ai-builder')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-all">
            <Bot className="w-3.5 h-3.5" /> Criar Agentes (AI Builder)
          </button>
          <button onClick={() => navigate('/agents')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-all">
            <Bot className="w-3.5 h-3.5" /> Ver Agentes
          </button>
          <button onClick={() => navigate('/automations')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-all">
            <Zap className="w-3.5 h-3.5" /> Ver Automações
          </button>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 bg-background">
          {(() => {
            const ctx = CONTEXTS.find(c => c.id === context)!
            const Icon = ctx.icon
            return (
              <>
                <Icon className={cn('w-5 h-5', ctx.color)} />
                <div>
                  <p className="font-semibold text-sm text-foreground">{ctx.label}</p>
                  <p className="text-xs text-muted-foreground">{ctx.description}</p>
                </div>
              </>
            )
          })()}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 text-xs"
              onClick={() => setMessages([])}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Nova conversa
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <EmptyState context={context} onPrompt={sendMessage} />
          ) : (
            <div className="space-y-6 pb-4">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onApply={markApplied} />
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Image attachments preview */}
        {attachments.length > 0 && (
          <div className="px-6 pt-3 flex gap-2 flex-wrap border-t border-border bg-muted/30">
            {attachments.map((att, i) => (
              <div key={i} className="relative group">
                <img
                  src={(att as any).image_url.url}
                  alt="attachment"
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-border bg-background">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Descreva o que deseja configurar... (Enter para enviar, Shift+Enter para nova linha)`}
                rows={2}
                className="resize-none pr-10 text-sm"
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar imagem"
                disabled={isLoading}
                className="h-9 w-9"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className="h-9 w-9"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            A IA pode criar e configurar webhooks e automações diretamente. Para criar agentes, use o{' '}
            <button onClick={() => navigate('/ai-builder')} className="underline hover:text-foreground transition-colors">
              AI Builder
            </button>.
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleImageUpload(e.target.files)}
      />
    </div>
  )
}

function EmptyState({ context, onPrompt }: { context: Context; onPrompt: (p: string) => void }) {
  const ctx = CONTEXTS.find(c => c.id === context)!
  const Icon = ctx.icon
  const prompts = QUICK_PROMPTS[context]

  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
        <Icon className={cn('w-8 h-8', ctx.color)} />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Configurador {ctx.label}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Descreva em linguagem natural o que você quer configurar. A IA vai criar e aplicar as configurações automaticamente.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPrompt(prompt)}
            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all text-sm text-foreground flex items-center gap-3 group"
          >
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
