import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Image, Globe, Share2, Link, RefreshCw, Trash2 } from 'lucide-react'
import type { CompanyKnowledgeSource } from '@/hooks/useCompanyKnowledge'

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  pdf: { icon: FileText, label: 'PDF' },
  image: { icon: Image, label: 'Imagem' },
  docx: { icon: FileText, label: 'DOCX' },
  website: { icon: Globe, label: 'Website' },
  social: { icon: Share2, label: 'Rede Social' },
  confluence: { icon: Link, label: 'Confluence' },
  zoho: { icon: Link, label: 'Zoho Desk' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  indexed: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  indexed: 'Indexado',
  error: 'Erro',
}

interface Props {
  source: CompanyKnowledgeSource
  onReindex: (id: string) => void
  onDelete: (id: string) => void
}

export function SourceCard({ source, onReindex, onDelete }: Props) {
  const meta = TYPE_META[source.source_type] || TYPE_META.pdf
  const Icon = meta.icon

  return (
    <div className="border rounded-xl bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{source.name}</h3>
            <Badge variant="outline" className={STATUS_STYLE[source.status]}>
              {STATUS_LABEL[source.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {meta.label} • {source.pages_count} páginas • {source.chunks_count} chunks
          </p>
          {source.last_synced_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Última sync: {new Date(source.last_synced_at).toLocaleDateString('pt-BR')}
              {source.sync_frequency && ` • Auto: ${source.sync_frequency}`}
            </p>
          )}
          {source.error_message && (
            <p className="text-xs text-destructive mt-1">{source.error_message}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onReindex(source.id)}>
          <RefreshCw className="w-3 h-3 mr-1" /> Re-indexar
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => onDelete(source.id)}>
          <Trash2 className="w-3 h-3 mr-1" /> Remover
        </Button>
      </div>
    </div>
  )
}
