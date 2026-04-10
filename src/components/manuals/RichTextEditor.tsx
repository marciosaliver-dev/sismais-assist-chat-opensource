import { useRef, useCallback, useState } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3,
  Link, Image, Video, Smile, Undo2, Redo2, Highlighter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  className?: string
}

const EMOJI_LIST = ['📋', '✅', '❌', '⚠️', '💡', '🖱️', '📱', '🔑', '📝', '🎯', '👉', '👆', '📌', '🔔', '💰', '🛒', '📦', '🏪', '🧾', '💳']

export default function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploading, setUploading] = useState(false)

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
    syncContent()
  }, [])

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        setUploading(true)
        try {
          const ext = file.type.split('/')[1] || 'png'
          const fileName = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('manual-images')
            .upload(fileName, file, { contentType: file.type })

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage
            .from('manual-images')
            .getPublicUrl(fileName)

          const img = `<img src="${urlData.publicUrl}" alt="Imagem do manual" style="max-width:100%;border-radius:8px;margin:8px 0;" />`
          document.execCommand('insertHTML', false, img)
          syncContent()
          toast.success('Imagem inserida!')
        } catch (err) {
          console.error('Upload error:', err)
          toast.error('Erro ao fazer upload da imagem')
        } finally {
          setUploading(false)
        }
        return
      }
    }
  }, [syncContent])

  function insertLink() {
    if (!linkUrl) return
    const html = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText || linkUrl}</a>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    syncContent()
    setLinkDialogOpen(false)
    setLinkUrl('')
    setLinkText('')
  }

  function insertVideo() {
    if (!videoUrl) return
    let embedUrl = videoUrl
    // YouTube
    const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`
    }
    const iframe = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:12px 0;border-radius:8px;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, iframe)
    syncContent()
    setVideoDialogOpen(false)
    setVideoUrl('')
  }

  function insertEmoji(emoji: string) {
    editorRef.current?.focus()
    document.execCommand('insertText', false, emoji)
    syncContent()
    setShowEmojiPicker(false)
  }

  function insertTipBlock() {
    const html = `<div class="tip">💡 <strong>Dica:</strong> Digite sua dica aqui</div>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    syncContent()
  }

  function insertWarningBlock() {
    const html = `<div class="warning">⚠️ <strong>Atenção:</strong> Digite seu alerta aqui</div>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    syncContent()
  }

  const ToolBtn = ({ icon: Icon, label, onClick, active }: { icon: any; label: string; onClick: () => void; active?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
        active && "bg-accent text-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        <ToolBtn icon={Bold} label="Negrito" onClick={() => exec('bold')} />
        <ToolBtn icon={Italic} label="Itálico" onClick={() => exec('italic')} />
        <ToolBtn icon={Underline} label="Sublinhado" onClick={() => exec('underline')} />
        <ToolBtn icon={Highlighter} label="Destacar" onClick={() => exec('hiliteColor', '#fef08a')} />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn icon={Heading2} label="Título H2" onClick={() => exec('formatBlock', 'h2')} />
        <ToolBtn icon={Heading3} label="Título H3" onClick={() => exec('formatBlock', 'h3')} />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn icon={List} label="Lista" onClick={() => exec('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} label="Lista Numerada" onClick={() => exec('insertOrderedList')} />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn icon={Link} label="Link" onClick={() => setLinkDialogOpen(true)} />
        <ToolBtn icon={Image} label="Imagem (Ctrl+V)" onClick={() => toast.info('Cole uma imagem com Ctrl+V ou arraste para o editor')} />
        <ToolBtn icon={Video} label="Vídeo" onClick={() => setVideoDialogOpen(true)} />
        <div className="w-px h-5 bg-border mx-1" />
        <div className="relative">
          <ToolBtn icon={Smile} label="Emojis" onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-48">
              {EMOJI_LIST.map((e) => (
                <button key={e} type="button" onClick={() => insertEmoji(e)} className="w-8 h-8 text-lg hover:bg-accent rounded flex items-center justify-center">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={insertTipBlock} title="Bloco de Dica" className="h-8 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          💡 Dica
        </button>
        <button type="button" onClick={insertWarningBlock} title="Bloco de Alerta" className="h-8 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          ⚠️ Alerta
        </button>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[360px] p-4 text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none
          [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
          [&_mark]:bg-yellow-200 [&_mark]:px-1 [&_mark]:rounded
          [&_.tip]:bg-blue-50 [&_.tip]:dark:bg-blue-950/30 [&_.tip]:border [&_.tip]:border-blue-200 [&_.tip]:dark:border-blue-800 [&_.tip]:rounded-lg [&_.tip]:p-3 [&_.tip]:my-3 [&_.tip]:text-sm
          [&_.warning]:bg-amber-50 [&_.warning]:dark:bg-amber-950/30 [&_.warning]:border [&_.warning]:border-amber-200 [&_.warning]:dark:border-amber-800 [&_.warning]:rounded-lg [&_.warning]:p-3 [&_.warning]:my-3 [&_.warning]:text-sm
          [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-2
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
          [&_a]:text-primary [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={syncContent}
        onPaste={handlePaste}
        data-placeholder="Escreva o conteúdo do manual aqui ou use a IA para gerar automaticamente..."
      />

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {uploading ? '📤 Enviando imagem...' : 'Ctrl+V para colar imagens · HTML rico'}
        </span>
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Inserir Link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL</label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="text-sm font-medium">Texto (opcional)</label>
              <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Clique aqui" />
            </div>
            <Button onClick={insertLink} disabled={!linkUrl} className="w-full">Inserir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Inserir Vídeo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL do YouTube</label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <Button onClick={insertVideo} disabled={!videoUrl} className="w-full">Inserir Vídeo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
