import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, BookOpen, FileText, Link as LinkIcon, Image as ImageIcon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicKnowledgeItem } from '@/hooks/usePublicKnowledge'

interface HelpContentCardProps {
  item: PublicKnowledgeItem
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string; bg: string }> = {
  video: { icon: PlayCircle, label: 'Vídeo', color: 'text-red-600', bg: 'bg-red-50' },
  text: { icon: BookOpen, label: 'Manual', color: 'text-blue-600', bg: 'bg-blue-50' },
  link: { icon: LinkIcon, label: 'Artigo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  image: { icon: ImageIcon, label: 'Imagem', color: 'text-orange-600', bg: 'bg-orange-50' },
  pdf: { icon: FileText, label: 'PDF', color: 'text-purple-600', bg: 'bg-purple-50' },
}

const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    return `${hrs}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getYouTubeThumbnail(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null
}

export function HelpContentCard({ item }: HelpContentCardProps) {
  const typeConfig = TYPE_CONFIG[item.content_type] || TYPE_CONFIG.text
  const TypeIcon = typeConfig.icon
  const thumbnail = item.thumbnail_url || getYouTubeThumbnail(item.video_url || item.original_url) || null
  const isManual = item.source_type === 'manual' || (item.content_type === 'text' && item.metadata?.steps)

  // For manuals use /help/manuals/:id (preserves step viewer), others use /help/content/:id
  const href = isManual ? `/help/manuals/${item.id}` : `/help/content/${item.id}`

  return (
    <Link to={href} className="group block">
      <Card className="border-border/60 bg-white overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 h-full">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className={cn('w-full h-full flex items-center justify-center', typeConfig.bg)}>
              <TypeIcon className={cn('w-12 h-12 opacity-40', typeConfig.color)} />
            </div>
          )}
          {/* Type badge overlay */}
          <div className="absolute top-3 left-3">
            <Badge className={cn('text-xs font-medium shadow-sm gap-1', typeConfig.bg, typeConfig.color, 'border-0')}>
              <TypeIcon className="w-3 h-3" />
              {isManual ? 'Manual' : typeConfig.label}
            </Badge>
          </div>
          {/* Duration badge for videos */}
          {item.content_type === 'video' && item.duration_seconds && (
            <div className="absolute bottom-2 right-2">
              <Badge className="bg-black/70 text-white text-xs border-0 gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(item.duration_seconds)}
              </Badge>
            </div>
          )}
          {/* Play overlay for videos */}
          {item.content_type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <PlayCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.difficulty_level && (
              <Badge variant="outline" className="text-xs">
                {LEVEL_LABELS[item.difficulty_level] || item.difficulty_level}
              </Badge>
            )}
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category === 'faq' ? 'FAQ' : item.category === 'tutorial' ? 'Tutorial' : item.category === 'troubleshooting' ? 'Solução' : item.category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
