import { useState } from 'react'
import DOMPurify from 'dompurify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ExternalLink, Copy, FileText, Code2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/integrations/supabase/types'

type KnowledgeDoc = Tables<'ai_knowledge_base'>

interface DocumentPreviewProps {
  doc: KnowledgeDoc | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentPreview({ doc, open, onOpenChange }: DocumentPreviewProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'text'>('formatted')

  if (!doc) return null

  const contentHtml = doc.content_html
  const hasHtml = !!contentHtml

  const handleCopy = () => {
    navigator.clipboard.writeText(doc.content)
    toast.success('Conteúdo copiado!')
  }

  // Sanitizacao com DOMPurify - seguro contra XSS
  const sanitizedHtml = hasHtml
    ? DOMPurify.sanitize(contentHtml!, {
        ALLOWED_TAGS: [
          'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'a', 'img',
          'strong', 'b', 'em', 'i', 'u', 's', 'del',
          'table', 'thead', 'tbody', 'tr', 'td', 'th',
          'blockquote', 'code', 'pre', 'hr', 'div', 'span',
          'figure', 'figcaption',
        ],
        ALLOWED_ATTR: [
          'href', 'title', 'target', 'rel',
          'src', 'alt', 'width', 'height', 'loading',
          'colspan', 'rowspan',
        ],
      })
    : null

  const showFormatted = hasHtml && viewMode === 'formatted'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {doc.title}
            {doc.original_url && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(doc.original_url!, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{doc.category}</Badge>
            <Badge variant="secondary">{doc.content_type}</Badge>
            {doc.tags?.map((tag, i) => (
              <Badge key={i} variant="outline">{tag}</Badge>
            ))}
          </div>

          {doc.description && (
            <p className="text-sm text-muted-foreground">{doc.description}</p>
          )}

          {doc.content_type === 'video' && doc.media_url && (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Player de vídeo (integração futura)</p>
            </div>
          )}

          {doc.content_type === 'image' && doc.media_url && (
            <img src={doc.media_url} alt={doc.title} className="w-full rounded-lg" />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Conteúdo</h4>
              <div className="flex items-center gap-1">
                {hasHtml && (
                  <div className="flex border border-border rounded-md overflow-hidden mr-2">
                    <button
                      className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
                        viewMode === 'formatted'
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setViewMode('formatted')}
                    >
                      <FileText className="w-3 h-3" />
                      Formatado
                    </button>
                    <button
                      className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors border-l border-border ${
                        viewMode === 'text'
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setViewMode('text')}
                    >
                      <Code2 className="w-3 h-3" />
                      Texto
                    </button>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] bg-muted rounded-lg p-4">
              {showFormatted ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert prose-img:rounded-lg prose-img:max-h-96 prose-a:text-primary"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml! }}
                />
              ) : (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{doc.content}</pre>
              )}
            </ScrollArea>
          </div>

          {doc.transcript && (
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Transcrição</h4>
              <ScrollArea className="h-[200px] bg-muted rounded-lg p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{doc.transcript}</p>
              </ScrollArea>
            </div>
          )}

          {doc.ocr_text && (
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Texto Extraído (OCR)</h4>
              <ScrollArea className="h-[200px] bg-muted rounded-lg p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{doc.ocr_text}</p>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
