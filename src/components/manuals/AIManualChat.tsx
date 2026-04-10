import { useState, useRef, useCallback } from 'react'
import { Sparkles, ImagePlus, Send, Copy, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface AIManualChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module?: string
  suggestedTitle?: string
  onApplyContent: (html: string) => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  image?: string // base64 image
  html?: string  // generated HTML for assistant messages
}

export default function AIManualChat({ open, onOpenChange, module, suggestedTitle, onApplyContent }: AIManualChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          setPastedImage(reader.result as string)
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPastedImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function sendMessage() {
    const text = input.trim()
    const image = pastedImage

    if (!text && !image) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || (image ? 'Gerar manual a partir desta tela' : ''),
      image: image || undefined,
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPastedImage(null)
    setLoading(true)
    scrollToBottom()

    try {
      // Build conversation history for context
      const history = newMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => {
        if (m.role === 'assistant') {
          return { role: 'assistant' as const, content: m.html || m.content }
        }
        return { role: 'user' as const, content: m.content }
      }).slice(0, -1) // exclude current message (sent separately)

      const { data, error } = await supabase.functions.invoke('generate-manual-content', {
        body: {
          image_base64: image || undefined,
          module: module || undefined,
          suggested_title: suggestedTitle || undefined,
          refinement_prompt: text || undefined,
          conversation_history: history.length > 0 ? history : undefined,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.suggested_title || 'Manual gerado',
        html: data.html_content,
      }

      setMessages([...newMessages, assistantMsg])
      scrollToBottom()
    } catch (err: any) {
      console.error('AI chat error:', err)
      toast.error(err.message || 'Erro ao gerar conteúdo')
      // Remove user message on error
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  function applyContent(html: string) {
    onApplyContent(html)
    toast.success('Conteúdo aplicado no editor!')
  }

  function copyHtml(html: string, idx: number) {
    navigator.clipboard.writeText(html)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
    toast.success('HTML copiado!')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-primary" />
            IA Escritora de Manuais
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Olá! 👋</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  Cole um <strong>print da tela</strong> do sistema e eu vou criar o manual completo pra você, com linguagem simples e passo a passo!
                </p>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>💡 Dicas:</p>
                <p>• Cole imagem com <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+V</kbd></p>
                <p>• Peça refinamentos: "Simplifique mais"</p>
                <p>• Peça mais exemplos: "Adicione exemplos do dia a dia"</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                "max-w-[90%] rounded-xl p-3 text-sm",
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}>
                {msg.image && (
                  <img src={msg.image} alt="Print" className="rounded-lg max-h-48 mb-2 w-full object-contain bg-background" />
                )}
                {msg.role === 'assistant' && msg.html ? (
                  <>
                    <div
                      className="prose prose-sm max-w-none text-foreground
                        [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2
                        [&_.tip]:bg-blue-50 [&_.tip]:dark:bg-blue-950/30 [&_.tip]:border [&_.tip]:border-blue-200 [&_.tip]:dark:border-blue-800 [&_.tip]:rounded-lg [&_.tip]:p-2 [&_.tip]:my-2 [&_.tip]:text-xs
                        [&_.warning]:bg-amber-50 [&_.warning]:dark:bg-amber-950/30 [&_.warning]:border [&_.warning]:border-amber-200 [&_.warning]:dark:border-amber-800 [&_.warning]:rounded-lg [&_.warning]:p-2 [&_.warning]:my-2 [&_.warning]:text-xs
                        [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:rounded
                        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1"
                      dangerouslySetInnerHTML={{ __html: msg.html }}
                    />
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                      <Button size="sm" onClick={() => applyContent(msg.html!)} className="gap-1.5 text-xs h-7">
                        <Check className="w-3 h-3" />
                        Aplicar no Editor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyHtml(msg.html!, idx)} className="gap-1.5 text-xs h-7">
                        {copiedIdx === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedIdx === idx ? 'Copiado' : 'Copiar HTML'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl p-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Escrevendo o manual...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Image preview */}
        {pastedImage && (
          <div className="px-4 py-2 border-t border-border">
            <div className="relative inline-block">
              <img src={pastedImage} alt="Preview" className="h-20 rounded-lg border border-border" />
              <button
                onClick={() => setPastedImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handleImagePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Cole um print ou descreva o que deseja..."
                className="resize-none min-h-[60px] pr-10 text-sm"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1">
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} className="hidden" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9"
                title="Anexar imagem"
              >
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={loading || (!input.trim() && !pastedImage)}
                className="w-9 h-9"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
