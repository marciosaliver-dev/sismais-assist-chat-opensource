import { useState, useMemo } from 'react'
import {
  PlayCircle,
  Play,
  Star,
  Eye,
  Clock,
  Subtitles,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import {
  usePublicKnowledge,
  usePublicKnowledgeCategories,
  type PublicKnowledgeItem,
} from '@/hooks/usePublicKnowledge'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/* ── helpers ── */

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatViews(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`
  return String(count)
}

function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
}

function avgDuration(items: PublicKnowledgeItem[]): number {
  const durations = items.filter((i) => i.duration_seconds && i.duration_seconds > 0)
  if (durations.length === 0) return 0
  const total = durations.reduce((s, i) => s + (i.duration_seconds ?? 0), 0)
  return Math.round(total / durations.length / 60)
}

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Iniciante', color: 'bg-gms-ok text-white' },
  intermediate: { label: 'Intermediário', color: 'bg-[#2563EB] text-white' },
  advanced: { label: 'Avançado', color: 'bg-[#7C3AED] text-white' },
}

const THUMB_GRADIENTS = [
  'from-[#10293F] to-[#1a3d5c]',
  'from-[#0f4c5c] to-[#10293F]',
  'from-[#1a3d5c] to-[#28a8a8]',
  'from-[#10293F] to-[#7C3AED]',
  'from-[#10293F] to-[#2563EB]',
  'from-[#1e3f5a] to-[#10293F]',
]

/* ── sub-components ── */

function VideoThumbnail({
  item,
  index,
  className,
}: {
  item: PublicKnowledgeItem
  index: number
  className?: string
}) {
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length]
  const level = item.difficulty_level ? LEVEL_LABELS[item.difficulty_level] : null

  return (
    <div className={cn('relative overflow-hidden rounded-xl group/thumb', className)}>
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={cn(
            'w-full h-full bg-gradient-to-br flex items-center justify-center',
            gradient
          )}
        >
          <PlayCircle className="w-12 h-12 text-white/30" />
        </div>
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/20 transition-all">
        <div className="w-12 h-12 rounded-full bg-white/90 group-hover/thumb:bg-gms-cyan flex items-center justify-center shadow-lg transition-colors">
          <Play className="w-5 h-5 text-gms-navy ml-0.5" fill="currentColor" />
        </div>
      </div>

      {/* Level badge top-left */}
      {level && (
        <span
          className={cn(
            'absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            level.color
          )}
        >
          {level.label}
        </span>
      )}

      {/* Duration badge bottom-right */}
      {item.duration_seconds && item.duration_seconds > 0 && (
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
          {formatDuration(item.duration_seconds)}
        </span>
      )}
    </div>
  )
}

function VideoCard({ item, index }: { item: PublicKnowledgeItem; index: number }) {
  return (
    <a
      href={item.video_url || item.original_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white rounded-xl border border-gms-g200 hover:shadow-lg hover:border-gms-cyan transition-all duration-200 overflow-hidden"
    >
      <VideoThumbnail item={item} index={index} className="aspect-video" />

      <div className="p-3.5">
        <span className="text-[11px] font-medium text-gms-g500 uppercase tracking-wide">
          {item.category || 'Geral'}
        </span>
        <h3 className="font-display font-bold text-sm text-gms-navy mt-1 line-clamp-2 group-hover:text-gms-cyan transition-colors">
          {item.title}
        </h3>
        <div className="flex items-center justify-between mt-3">
          <span className="flex items-center gap-1 text-[11px] text-gms-g500">
            <Eye className="w-3.5 h-3.5" />
            {formatViews(item.usage_count)} visualizações
          </span>
          {isNew(item.created_at) && (
            <span className="text-[10px] font-bold bg-gms-cyan text-gms-navy px-2 py-0.5 rounded-full">
              NOVO
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

/* ── main page ── */

export default function HelpVideos() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const { items: allVideos, isLoading: videosLoading } = usePublicKnowledge({
    contentType: 'video',
  })
  const { products, isLoading: productsLoading } = usePublicKnowledgeCategories()

  const filteredVideos = useMemo(
    () =>
      selectedProductId
        ? allVideos.filter((v) => v.product_id === selectedProductId)
        : allVideos,
    [allVideos, selectedProductId]
  )

  // Featured = most viewed
  const featured = useMemo(
    () =>
      filteredVideos.length > 0
        ? [...filteredVideos].sort((a, b) => b.usage_count - a.usage_count)[0]
        : null,
    [filteredVideos]
  )

  // Group by product
  const videosByProduct = useMemo(() => {
    const map = new Map<string, { name: string; items: PublicKnowledgeItem[] }>()
    const nonFeatured = filteredVideos.filter((v) => v.id !== featured?.id)
    for (const v of nonFeatured) {
      const pid = v.product_id || '__none'
      if (!map.has(pid)) {
        const product = products.find((p) => p.id === pid)
        map.set(pid, { name: product?.name || 'Geral', items: [] })
      }
      map.get(pid)!.items.push(v)
    }
    return Array.from(map.entries())
  }, [filteredVideos, featured, products])

  const isLoading = videosLoading || productsLoading
  const avgMin = avgDuration(allVideos)

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF4FC]">
      <HelpHeader />

      {/* ── Page Header ── */}
      <div className="bg-gms-navy">
        <div className="max-w-[1060px] mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[13px] text-white/50 mb-4">
            <span className="hover:text-white/80 cursor-pointer transition-colors">Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white font-medium">Vídeos Tutoriais</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-white mb-1.5">
            Vídeos Tutoriais
          </h1>
          <p className="text-white/60 text-sm mb-5">
            Aprenda vendo como faz — tutoriais curtos e objetivos
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-5 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <PlayCircle className="w-4 h-4 text-gms-cyan" />
              <strong className="text-white font-semibold">{allVideos.length}</strong> vídeos
            </span>
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <Clock className="w-4 h-4 text-gms-cyan" />
              Duração média: <strong className="text-white font-semibold">{avgMin} min</strong>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <Subtitles className="w-4 h-4 text-gms-cyan" />
              Legendas em PT-BR
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="max-w-[1060px] mx-auto w-full px-6 py-8">
        <div className="grid gap-8" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* ── Left Sidebar ── */}
          <aside className="self-start sticky top-4">
            <div className="bg-white rounded-xl border border-gms-g200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gms-g200">
                <h2 className="font-display font-semibold text-sm text-gms-navy">Categorias</h2>
              </div>
              <nav className="p-2 flex flex-col gap-0.5">
                {/* All */}
                <button
                  onClick={() => setSelectedProductId(null)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    selectedProductId === null
                      ? 'bg-gms-cyan-light text-gms-navy font-bold'
                      : 'text-gms-g500 hover:bg-gms-g100'
                  )}
                >
                  <span
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0',
                      selectedProductId === null
                        ? 'bg-gms-cyan text-gms-navy font-bold'
                        : 'bg-gms-g100 text-gms-g500'
                    )}
                  >
                    <PlayCircle className="w-4 h-4" />
                  </span>
                  <span className="flex-1">Todos</span>
                  <span className="text-[11px] text-gms-g500">{allVideos.length}</span>
                </button>

                {productsLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                        <Skeleton className="w-7 h-7 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                      </div>
                    ))
                  : products.map((product) => {
                      const count = allVideos.filter(
                        (v) => v.product_id === product.id
                      ).length
                      if (count === 0) return null
                      const isActive = selectedProductId === product.id
                      return (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProductId(product.id)}
                          className={cn(
                            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
                            isActive
                              ? 'bg-gms-cyan-light text-gms-navy font-bold'
                              : 'text-gms-g500 hover:bg-gms-g100'
                          )}
                        >
                          <span
                            className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0',
                              isActive
                                ? 'bg-gms-cyan text-gms-navy font-bold'
                                : 'bg-gms-g100 text-gms-g500'
                            )}
                          >
                            {product.icon || product.name.charAt(0)}
                          </span>
                          <span className="flex-1 truncate">{product.name}</span>
                          <span className="text-[11px] text-gms-g500">{count}</span>
                        </button>
                      )
                    })}
              </nav>
            </div>
          </aside>

          {/* ── Content Area ── */}
          <div className="min-w-0">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-56 rounded-xl" />
                <div className="grid grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl overflow-hidden bg-white border border-gms-g200">
                      <Skeleton className="aspect-video" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gms-g100 flex items-center justify-center mb-4">
                  <PlayCircle className="w-8 h-8 text-gms-g500" />
                </div>
                <h3 className="font-display font-semibold text-gms-navy mb-1">
                  Nenhum vídeo encontrado
                </h3>
                <p className="text-gms-g500 text-sm">
                  Ainda não há vídeos publicados para esta categoria.
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* ── Featured Video ── */}
                {featured && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-[#FFB800]" fill="#FFB800" />
                      <span className="text-sm font-semibold text-gms-navy">
                        Destaque da Semana
                      </span>
                    </div>
                    <a
                      href={featured.video_url || featured.original_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group grid grid-cols-[1.2fr_1fr] bg-white rounded-xl border border-gms-g200 overflow-hidden hover:shadow-lg hover:border-gms-cyan transition-all duration-200"
                    >
                      <VideoThumbnail
                        item={featured}
                        index={0}
                        className="aspect-video"
                      />
                      <div className="p-5 flex flex-col justify-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#FFB800] text-gms-navy px-2 py-0.5 rounded-full w-fit mb-2">
                          <Eye className="w-3 h-3" /> Mais assistido
                        </span>
                        <h3 className="font-display font-bold text-lg text-gms-navy group-hover:text-gms-cyan transition-colors line-clamp-2">
                          {featured.title}
                        </h3>
                        {featured.description && (
                          <p className="text-sm text-gms-g500 mt-2 line-clamp-2">
                            {featured.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-[12px] text-gms-g500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {formatViews(featured.usage_count)} visualizações
                          </span>
                          {(() => {
                            const total =
                              featured.helpful_count + featured.not_helpful_count
                            if (total === 0) return null
                            const pct = Math.round(
                              (featured.helpful_count / total) * 100
                            )
                            return (
                              <span className="flex items-center gap-1">
                                👍 {pct}% aprovação
                              </span>
                            )
                          })()}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(featured.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </a>
                  </div>
                )}

                {/* ── Video Sections by Product ── */}
                {videosByProduct.map(([pid, group]) => (
                  <div key={pid}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display font-bold text-base text-gms-navy">
                        {group.name}
                      </h2>
                      {group.items.length > 3 && (
                        <button className="flex items-center gap-1 text-sm font-medium text-gms-cyan hover:underline">
                          Ver todos <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-5">
                      {group.items.slice(0, 3).map((item, i) => (
                        <VideoCard key={item.id} item={item} index={i} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <HelpFloatingChat />
    </div>
  )
}
