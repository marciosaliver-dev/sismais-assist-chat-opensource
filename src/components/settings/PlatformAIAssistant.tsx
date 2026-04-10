import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, Send, Loader2, Check, X, Globe, Paperclip, FileText, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

interface AttachedFile {
  name: string
  type: string
  base64: string
  preview?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export type AIAssistantContext = 'agent' | 'webhook' | 'automation' | 'general'

interface PlatformAIAssistantProps {
  context: AIAssistantContext
  currentConfig?: Record<string, any>
  onApplyConfig?: (tool: string, config: Record<string, any>) => void
  onClose: () => void
}

const CONTEXT_LABELS: Record<AIAssistantContext, string> = {
  agent: 'Configurar Agente',
  webhook: 'Configurar Webhook',
  automation: 'Criar Automação',
  general: 'Assistente IA',
}

const CONTEXT_GREETINGS: Record<AIAssistantContext, string> = {
  agent: '👋 Olá! Vou te ajudar a configurar seu agente de IA.\n\nPara começar, me diga: **qual o nome do agente** e **para qual empresa** ele vai atender?\n\n💡 Dica: você pode colar um **link do site**, **colar imagens (Ctrl+V)**, **arrastar arquivos** (PDF, planilhas) ou clicar no 📎 para anexar!',
  webhook: '👋 Olá! Vou te ajudar a configurar um webhook de entrada.\n\nMe diga: **qual plataforma** vai enviar os dados e **qual o objetivo** da integração?',
  automation: '👋 Olá! Vou te ajudar a criar uma automação.\n\nMe diga: **o que você quer automatizar** e **quando deve ser disparado**?',
  general: '👋 Olá! Sou o assistente inteligente da plataforma.\n\nPosso te ajudar a configurar **agentes**, **webhooks** ou **automações**. O que precisa?',
}

const URL_REGEX = /^https?:\/\/[^\s]+$/
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 3
const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'text/csv', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function isUrl(text: string): boolean {
  return URL_REGEX.test(text.trim())
}

function isImageType(type: string): boolean {
  return type.startsWith('image/')
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function PlatformAIAssistant({ context, currentConfig, onApplyConfig, onClose }: PlatformAIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: CONTEXT_GREETINGS[context] },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [scrapingUrl, setScrapingUrl] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [pendingConfig, setPendingConfig] = useState<{ tool: string; config: any } | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const processFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ O arquivo "${file.name}" excede o limite de 5MB.` }])
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Tipo de arquivo não suportado: ${file.type || file.name}` }])
      return
    }
    if (attachedFiles.length >= MAX_FILES) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Máximo de ${MAX_FILES} arquivos por vez.` }])
      return
    }

    const base64 = await fileToBase64(file)
    const preview = isImageType(file.type) ? base64 : undefined

    setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, base64, preview }])
  }, [attachedFiles.length])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) processFile(file)
        return
      }
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    for (let i = 0; i < files.length; i++) {
      processFile(files[i])
    }
  }, [processFile])

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleScrapeUrl = async (url: string) => {
    setScrapingUrl(true)
    setShowUrlInput(false)
    setUrlInput('')

    setMessages(prev => [
      ...prev,
      { role: 'user', content: `🔗 ${url}` },
      { role: 'assistant', content: '🔍 Analisando o site... Isso pode levar alguns segundos.' },
    ])

    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url, options: { formats: ['markdown'] } },
      })

      if (error) throw new Error(error.message)
      if (!data?.success && !data?.data) throw new Error(data?.error || 'Falha ao analisar o site')

      const markdown = data.data?.markdown || data.markdown || ''
      const title = data.data?.metadata?.title || data.metadata?.title || url

      const truncated = markdown.length > 4000
        ? markdown.substring(0, 4000) + '\n\n[... conteúdo truncado ...]'
        : markdown

      const siteContent = `Título: ${title}\nURL: ${url}\n\nConteúdo:\n${truncated}`

      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1))

      await sendToAI(
        [
          ...messages,
          { role: 'user', content: `Analise este site e configure o agente automaticamente: ${url}` },
        ],
        siteContent
      )
    } catch (err: any) {
      setMessages(prev => [
        ...prev.filter((_, i) => i !== prev.length - 1),
        { role: 'assistant', content: `❌ Não consegui analisar o site: ${err.message || 'Erro desconhecido'}. Tente novamente ou me forneça as informações manualmente.` },
      ])
    } finally {
      setScrapingUrl(false)
    }
  }

  const sendToAI = async (chatMessages: ChatMessage[], siteContent?: string, files?: AttachedFile[]) => {
    setLoading(true)
    try {
      // Prepare files for backend
      const filesToSend = files?.map(f => ({
        name: f.name,
        type: f.type,
        base64: f.base64,
      }))

      const { data, error } = await supabase.functions.invoke('agent-configurator', {
        body: {
          messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
          currentConfig,
          ...(siteContent ? { siteContent } : {}),
          ...(filesToSend?.length ? { files: filesToSend } : {}),
        },
      })

      if (error) throw error

      if (data.type === 'config') {
        setPendingConfig({ tool: data.tool || 'generate_agent_config', config: data.config })
        setMessages([...chatMessages, { role: 'assistant', content: data.message || '✅ Configuração gerada! Revise e aplique.' }])
      } else {
        setMessages([...chatMessages, { role: 'assistant', content: data.message }])
      }
    } catch (err: any) {
      setMessages([...chatMessages, { role: 'assistant', content: '❌ Erro ao processar. Tente novamente.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || loading || scrapingUrl) return
    const text = input.trim()
    setInput('')

    // Auto-detect URL (only if no files attached)
    if (isUrl(text) && context === 'agent' && attachedFiles.length === 0) {
      await handleScrapeUrl(text)
      return
    }

    // Build user message with image previews
    const imageFiles = attachedFiles.filter(f => isImageType(f.type))
    const docFiles = attachedFiles.filter(f => !isImageType(f.type))
    const currentFiles = [...attachedFiles]
    setAttachedFiles([])

    const displayContent = text || (currentFiles.length > 0
      ? `📎 ${currentFiles.map(f => f.name).join(', ')}`
      : '')

    const userMsg: ChatMessage = {
      role: 'user',
      content: displayContent,
      images: imageFiles.map(f => f.preview || f.base64),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    // For CSV files, read text content on frontend
    const processedFiles: AttachedFile[] = []
    for (const f of currentFiles) {
      if (f.type === 'text/csv') {
        // Already base64, backend will handle
        processedFiles.push(f)
      } else {
        processedFiles.push(f)
      }
    }

    await sendToAI(newMessages, undefined, processedFiles.length > 0 ? processedFiles : undefined)
  }

  const applyConfig = () => {
    if (!pendingConfig || !onApplyConfig) return
    onApplyConfig(pendingConfig.tool, pendingConfig.config)
    setPendingConfig(null)
    setMessages(prev => [...prev, { role: 'assistant', content: '✅ Configuração aplicada! Revise os campos e ajuste o que precisar.' }])
  }

  const isProcessing = loading || scrapingUrl

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full border-l border-border bg-muted/20 relative",
        isDragging && "ring-2 ring-primary ring-inset"
      )}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card border-2 border-dashed border-primary rounded-xl px-6 py-4 text-sm font-medium text-primary">
            📎 Solte o arquivo aqui
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.csv,.xlsx,.xls"
        multiple
        onChange={(e) => {
          const files = e.target.files
          if (files) {
            for (let i = 0; i < files.length; i++) processFile(files[i])
          }
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{CONTEXT_LABELS[context]}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] px-3 py-2 rounded-2xl text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm'
              )}>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Anexo"
                        className="w-20 h-20 object-cover rounded-lg border border-border/50"
                      />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Pending config approval */}
      {pendingConfig && (
        <div className="px-4 py-3 border-t border-border bg-primary/5 shrink-0">
          <p className="text-xs font-medium text-foreground mb-2">
            Configuração gerada{pendingConfig.config?.name ? `: ${pendingConfig.config.name}` : ''}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyConfig} className="gap-1 flex-1">
              <Check className="w-3.5 h-3.5" /> Aplicar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingConfig(null)} className="gap-1">
              <X className="w-3.5 h-3.5" /> Descartar
            </Button>
          </div>
        </div>
      )}

      {/* URL Input (toggled) */}
      {showUrlInput && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 shrink-0">
          <div className="flex gap-2 items-center">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && urlInput.trim()) handleScrapeUrl(urlInput.trim())
              }}
              placeholder="https://empresa.com.br"
              className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              disabled={isProcessing}
            />
            <Button size="sm" variant="default" className="h-8 text-xs"
              onClick={() => urlInput.trim() && handleScrapeUrl(urlInput.trim())}
              disabled={!urlInput.trim() || isProcessing}
            >
              Analisar
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              onClick={() => { setShowUrlInput(false); setUrlInput('') }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 shrink-0">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => (
              <div key={i} className="relative group">
                {file.preview ? (
                  <img src={file.preview} alt={file.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-border bg-card flex flex-col items-center justify-center gap-0.5 px-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={attachedFiles.length > 0 ? "Adicione uma mensagem (opcional)..." : "Digite sua resposta..."}
            className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isProcessing}
          />
          {context === 'agent' && (
            <>
              <Button
                size="icon" variant="outline" className="h-9 w-9 rounded-xl shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                size="icon" variant="outline" className="h-9 w-9 rounded-xl shrink-0"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={isProcessing}
                title="Analisar site"
              >
                <Globe className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            size="icon" className="h-9 w-9 rounded-xl shrink-0"
            onClick={sendMessage}
            disabled={isProcessing || (!input.trim() && attachedFiles.length === 0)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
