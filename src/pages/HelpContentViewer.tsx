import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ThumbsUp, ThumbsDown, Clock, BookOpen, PlayCircle, ExternalLink, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { HelpContentGrid } from '@/components/help/HelpContentGrid'
import { usePublicKnowledgeItem, usePublicKnowledge } from '@/hooks/usePublicKnowledge'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    return `${hrs}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`
  }
  return `${mins} min`
}

export default function HelpContentViewer() {
  const { id } = useParams<{ id: string }>()
  const { item, isLoading } = usePublicKnowledgeItem(id)

  // Related content from same product
  const { items: relatedItems } = usePublicKnowledge({
    productId: item?.product_id,
    limit: 3,
  })

  // Filter out current item from related
  const related = relatedItems.filter(r => r.id !== id)

  const handleVote = async (helpful: boolean) => {
    if (!id) return
    try {
      await supabase.rpc('increment_vote', {
        doc_id: id,
        vote_field: helpful ? 'helpful_count' : 'not_helpful_count'
      })
    } catch (_) {
      // Silent fail for public voting
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
        <HelpHeader />
        <div className="max-w-4xl mx-auto w-full px-6 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-[400px] w-full rounded-xl mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
        <HelpHeader />
        <div className="max-w-4xl mx-auto w-full px-6 py-20 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Conteúdo não encontrado</h2>
          <p className="text-muted-foreground mb-4">Este conteúdo pode ter sido removido ou não está disponível.</p>
          <Button asChild>
            <Link to="/help/content">Voltar para Conteúdos</Link>
          </Button>
        </div>
      </div>
    )
  }

  const embedUrl = getYouTubeEmbedUrl(item.video_url || item.original_url)
  const isVideo = item.content_type === 'video'

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
      <HelpHeader />

      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        {/* Breadcrumb */}
        <Link
          to="/help/content"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Conteúdos
        </Link>

        {/* Title area */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {isVideo && (
              <Badge className="bg-red-50 text-red-600 border-0 gap-1">
                <PlayCircle className="w-3 h-3" />
                Vídeo
              </Badge>
            )}
            {item.difficulty_level && (
              <Badge variant="outline" className="text-xs">
                {LEVEL_LABELS[item.difficulty_level] || item.difficulty_level}
              </Badge>
            )}
            {item.duration_seconds && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="w-3 h-3" />
                {formatDuration(item.duration_seconds)}
              </Badge>
            )}
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category === 'faq' ? 'FAQ' : item.category === 'tutorial' ? 'Tutorial' : item.category}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{item.title}</h1>
          {item.description && (
            <p className="text-muted-foreground mt-2 text-lg">{item.description}</p>
          )}
        </div>

        {/* Video player */}
        {isVideo && embedUrl && (
          <div className="mb-8 rounded-xl overflow-hidden shadow-lg bg-black aspect-video">
            <iframe
              src={embedUrl}
              title={item.title}
              allowFullScreen
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}

        {/* Content body */}
        {item.content && !isVideo && (
          <div className="bg-white rounded-xl border border-border/60 p-8 mb-8 prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {item.content}
            </div>
          </div>
        )}

        {/* External link */}
        {item.original_url && item.content_type === 'link' && (
          <div className="mb-8">
            <a
              href={item.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ver fonte original
            </a>
          </div>
        )}

        {/* Feedback */}
        <div className="bg-white rounded-xl border border-border/60 p-6 mb-8">
          <p className="text-sm font-medium text-foreground mb-3">Este conteúdo foi útil?</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleVote(true)}>
              <ThumbsUp className="w-4 h-4" />
              Sim, ajudou!
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleVote(false)}>
              <ThumbsDown className="w-4 h-4" />
              Não ajudou
            </Button>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-xl border border-border/60 p-6 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Headphones className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Ainda com dúvida?</p>
            <p className="text-sm text-muted-foreground">Abra um chamado e nossa equipe te ajuda.</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shrink-0">
            <Link to="/help/tickets">Abrir Chamado</Link>
          </Button>
        </div>

        {/* Related content */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-foreground mb-5">Conteúdos Relacionados</h2>
            <HelpContentGrid items={related} isLoading={false} />
          </section>
        )}
      </div>

      <HelpFloatingChat />
    </div>
  )
}
