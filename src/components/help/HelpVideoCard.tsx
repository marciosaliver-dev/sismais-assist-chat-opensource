import { useState } from 'react'
import { Play, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface HelpVideo {
  id: string
  title: string
  description?: string | null
  module: string
  level: string
  duration_seconds?: number | null
  thumbnail_url?: string | null
  video_url: string
}

interface HelpVideoCardProps {
  video: HelpVideo
}

const LEVEL_STYLES: Record<string, { label: string; classes: string }> = {
  iniciante: { label: 'Iniciante', classes: 'bg-emerald-500 text-white' },
  intermediario: { label: 'Intermediário', classes: 'bg-amber-500 text-white' },
  avancado: { label: 'Avançado', classes: 'bg-red-500 text-white' },
}

const MODULE_LABELS: Record<string, string> = {
  vendas_pdv: 'Vendas (PDV)',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  fiscal_nfe: 'Fiscal (NF-e)',
  geral: 'Geral',
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function HelpVideoCard({ video }: HelpVideoCardProps) {
  const [open, setOpen] = useState(false)
  const levelStyle = LEVEL_STYLES[video.level] ?? LEVEL_STYLES.iniciante
  const duration = formatDuration(video.duration_seconds)

  return (
    <>
      <div
        className="group rounded-2xl border border-border/60 bg-white overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-slate-900 overflow-hidden">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
          )}

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/50 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-200">
              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Level badge */}
          <div className="absolute top-3 left-3">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', levelStyle.classes)}>
              {levelStyle.label}
            </span>
          </div>

          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              {duration}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <Badge variant="outline" className="text-xs mb-2 bg-slate-50">
            {MODULE_LABELS[video.module] ?? video.module}
          </Badge>
          <h3 className="font-semibold text-foreground text-base leading-tight mb-1 line-clamp-2">
            {video.title}
          </h3>
          {video.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
          )}
        </div>
      </div>

      {/* Video Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base">{video.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={video.video_url}
                title={video.title}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            {video.description && (
              <p className="mt-3 text-sm text-muted-foreground">{video.description}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
