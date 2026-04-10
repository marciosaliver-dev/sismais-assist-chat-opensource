import { useState } from 'react'
import { Bug, Lightbulb, Sparkles, Clock, CheckCircle2, XCircle, Search, Loader2, ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { FeatureRequest, FeedbackStatus } from '@/hooks/useFeedback'
import { useUpdateFeedback } from '@/hooks/useFeedback'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const typeConfig = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  improvement: { icon: Lightbulb, label: 'Melhoria', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  feature: { icon: Sparkles, label: 'Feature', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
}

const statusConfig: Record<FeedbackStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  in_review: { label: 'Em Análise', variant: 'secondary' },
  in_progress: { label: 'Em Desenvolvimento', variant: 'default' },
  done: { label: 'Concluído', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
}

interface FeedbackCardProps {
  item: FeatureRequest
}

export function FeedbackCard({ item }: FeedbackCardProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const updateFeedback = useUpdateFeedback()

  const [expanded, setExpanded] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState<FeedbackStatus>(item.status)
  const [resolution, setResolution] = useState(item.resolution_notes || '')
  const [saving, setSaving] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const typeInfo = typeConfig[item.type]
  const statusInfo = statusConfig[item.status]
  const TypeIcon = typeInfo.icon
  const createdAt = new Date(item.created_at).toLocaleDateString('pt-BR')

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateFeedback.mutateAsync({
        id: item.id,
        status: newStatus,
        resolution_notes: resolution.trim() || undefined,
      })
      toast.success('Solicitação atualizada')
      setEditingStatus(false)
    } catch {
      toast.error('Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md cursor-pointer',
          item.status === 'done' && 'opacity-80'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', typeInfo.bg)}>
              <TypeIcon className={cn('w-4 h-4', typeInfo.color)} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{item.requested_by_name}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {createdAt}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.images.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="w-3 h-3" />
                {item.images.length}
              </span>
            )}
            <Badge variant={statusInfo.variant} className="text-[10px]">
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            {item.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            )}

            {item.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Imagem ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setLightboxImage(url)}
                  />
                ))}
              </div>
            )}

            {/* Resolução (visível quando status = done) */}
            {item.status === 'done' && item.resolution_notes && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  O que foi feito
                </div>
                <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">
                  {item.resolution_notes}
                </p>
                {item.resolved_at && (
                  <p className="text-[10px] text-green-600 dark:text-green-500 mt-1">
                    Resolvido em {new Date(item.resolved_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )}

            {item.status === 'rejected' && item.resolution_notes && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Motivo da rejeição
                </div>
                <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                  {item.resolution_notes}
                </p>
              </div>
            )}

            {/* Admin controls */}
            {isAdmin && (
              <div className="border-t border-border pt-3 space-y-2">
                {!editingStatus ? (
                  <Button size="sm" variant="outline" onClick={() => setEditingStatus(true)}>
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Gerenciar
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FeedbackStatus)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {(newStatus === 'done' || newStatus === 'rejected') && (
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder={newStatus === 'done' ? 'Descreva o que foi feito...' : 'Motivo da rejeição...'}
                        rows={3}
                        className="text-sm"
                      />
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingStatus(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxImage && (
            <img src={lightboxImage} alt="Imagem ampliada" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
