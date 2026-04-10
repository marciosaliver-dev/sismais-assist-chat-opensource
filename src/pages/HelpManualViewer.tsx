import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ListChecks, Clock, Pencil, ThumbsUp, ThumbsDown, ChevronRight,
  ArrowLeft, ArrowRight, Bot, Headphones, Lightbulb, Check, BookOpen,
  Eye, ChevronDown,
} from 'lucide-react'
import { usePublicKnowledgeItem, usePublicKnowledge } from '@/hooks/usePublicKnowledge'
import { useManualFeedback } from '@/hooks/useManualArticles'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '~5 min'
  return `~${Math.ceil(seconds / 60)} min`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface TocHeading {
  id: string
  text: string
  level: number
}

function extractHeadings(html: string): TocHeading[] {
  const regex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi
  const headings: TocHeading[] = []
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const existingId = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    const id = existingId || `heading-${idx}`
    headings.push({ id, text, level })
    idx++
  }
  return headings
}

function injectHeadingIds(html: string, headings: TocHeading[]): string {
  let idx = 0
  return html.replace(/<h([23])([^>]*)>/gi, (_fullMatch, level, attrs) => {
    if (idx < headings.length) {
      const heading = headings[idx]
      idx++
      if (attrs.includes('id=')) return `<h${level}${attrs}>`
      return `<h${level}${attrs} id="${heading.id}">`
    }
    return `<h${level}${attrs}>`
  })
}

const LEVEL_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  beginner: { label: 'Iniciante', bg: 'bg-[#F0FDF4]', color: 'text-[#16A34A]' },
  intermediate: { label: 'Intermediario', bg: 'bg-[#FFFBEB]', color: 'text-[#92400E]' },
  advanced: { label: 'Avancado', bg: 'bg-[#FEF2F2]', color: 'text-[#DC2626]' },
}

export default function HelpManualViewer() {
  const { id } = useParams<{ id: string }>()
  const { item, isLoading } = usePublicKnowledgeItem(id)
  const feedbackMutation = useManualFeedback()

  const [currentStep, setCurrentStep] = useState(0)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Related articles
  const { items: relatedItems } = usePublicKnowledge({
    productId: item?.product_id,
    limit: 4,
  })

  const relatedArticles = useMemo(
    () => relatedItems.filter((r) => r.id !== id).slice(0, 3),
    [relatedItems, id]
  )

  // Steps
  const meta = item?.metadata as Record<string, unknown> | null
  const rawSteps: string[] = useMemo(() => {
    if (meta?.steps && Array.isArray(meta.steps)) {
      return (meta.steps as any[]).map(s => typeof s === 'string' ? s : s.title || String(s))
    }
    if (item?.content) {
      const headings = item.content.match(/<h[23][^>]*>(.*?)<\/h[23]>/gi)
      if (headings && headings.length > 1) {
        return headings.map(h => h.replace(/<[^>]*>/g, '').trim())
      }
    }
    return []
  }, [meta, item?.content])

  const totalSteps = rawSteps.length
  const hasSteps = totalSteps > 0
  const progress = hasSteps ? Math.round((doneSteps.size / totalSteps) * 100) : 0

  // TOC headings from content
  const tocHeadings = useMemo(() => {
    if (!item?.content) return []
    return extractHeadings(item.content)
  }, [item?.content])

  const processedContent = useMemo(() => {
    if (!item?.content) return ''
    return injectHeadingIds(item.content, tocHeadings)
  }, [item?.content, tocHeadings])

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    if (tocHeadings.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    const timer = setTimeout(() => {
      tocHeadings.forEach((h) => {
        const el = document.getElementById(h.id)
        if (el) observer.observe(el)
      })
    }, 300)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [tocHeadings])

  function goToStep(idx: number) {
    if (idx > currentStep) {
      setDoneSteps(prev => { const next = new Set(prev); next.add(currentStep); return next })
    }
    setCurrentStep(idx)
  }

  function handleFeedback(helpful: boolean) {
    if (!id || feedbackGiven) return
    setFeedbackGiven(helpful ? 'up' : 'down')
    feedbackMutation.mutate({ id, helpful }, {
      onSuccess: () => toast.success(helpful ? 'Obrigado pelo feedback!' : 'Vamos melhorar este artigo.'),
    })
  }

  const levelConfig = LEVEL_BADGE[item?.difficulty_level || 'beginner'] || LEVEL_BADGE.beginner

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <HelpHeader />
        <div className="bg-white border-b border-[#E5E5E5]">
          <div className="max-w-[1100px] mx-auto px-5 py-3">
            <div className="h-4 w-64 bg-[#F5F5F5] rounded animate-pulse" />
          </div>
        </div>
        <main className="flex-1 max-w-[1100px] mx-auto w-full px-5 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
            <div className="hidden lg:block h-80 bg-white rounded-xl border border-[#E5E5E5] animate-pulse" />
            <div className="h-[500px] bg-white rounded-xl border border-[#E5E5E5] animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  // Not found
  if (!item) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <HelpHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="w-12 h-12 text-[#CCC] mx-auto mb-3" />
            <h2 className="font-semibold text-[#333] font-[Poppins,sans-serif]">Manual nao encontrado</h2>
            <Link to="/help/manuals" className="text-[#45E5E5] text-sm hover:underline mt-2 block">
              Voltar aos Manuais
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <HelpHeader />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-[#E5E5E5]">
        <div className="max-w-[1100px] mx-auto px-5 py-3 flex items-center gap-2 text-[13px] text-[#666] overflow-x-auto">
          <Link to="/help-center" className="hover:text-[#10293F] transition-colors shrink-0">Central de Ajuda</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#CCC] shrink-0" />
          <Link to="/help/manuals" className="hover:text-[#10293F] transition-colors shrink-0">Manuais</Link>
          {item.category && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#CCC] shrink-0" />
              <span className="text-[#999] shrink-0">{item.category}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#CCC] shrink-0" />
          <span className="text-[#333] font-medium truncate">{item.title}</span>
        </div>
      </div>

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-5 py-8">
        <div className={cn(
          'grid gap-6 items-start',
          tocHeadings.length > 0 || hasSteps
            ? 'grid-cols-1 lg:grid-cols-[220px_1fr]'
            : 'grid-cols-1 max-w-3xl mx-auto'
        )}>

          {/* LEFT SIDEBAR: TOC or Steps */}
          {(tocHeadings.length > 0 || hasSteps) && (
            <aside className="hidden lg:block sticky top-[72px]">
              {/* Step navigator */}
              {hasSteps && (
                <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden mb-4" style={{ boxShadow: '0 1px 2px rgba(16,41,63,0.06)' }}>
                  <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-[#10293F]" />
                    <span className="text-sm font-semibold text-[#10293F] font-[Poppins,sans-serif]">Passo a Passo</span>
                  </div>
                  <nav className="px-3 py-2 space-y-0.5 max-h-[300px] overflow-y-auto">
                    {rawSteps.map((step, i) => {
                      const isDone = doneSteps.has(i)
                      const isActive = i === currentStep
                      return (
                        <button
                          key={i}
                          onClick={() => goToStep(i)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all text-[12px]',
                            isActive && 'bg-[#F8FAFC]',
                          )}
                        >
                          <span className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all',
                            isDone ? 'bg-[#16A34A] text-white'
                              : isActive ? 'bg-[#10293F] text-white'
                              : 'bg-[#F5F5F5] text-[#666] border border-[#E5E5E5]'
                          )}>
                            {isDone ? <Check className="w-3 h-3" /> : i + 1}
                          </span>
                          <span className={cn(
                            'line-clamp-2 leading-snug',
                            isActive ? 'text-[#10293F] font-semibold' : 'text-[#666]'
                          )}>{step}</span>
                        </button>
                      )
                    })}
                  </nav>
                  {/* Progress */}
                  <div className="px-4 py-3 border-t border-[#E5E5E5]">
                    <div className="flex justify-between text-[11px] text-[#666] mb-1.5">
                      <span>Progresso</span>
                      <span className="font-semibold text-[#10293F]">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#45E5E5] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Table of Contents */}
              {tocHeadings.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(16,41,63,0.06)' }}>
                  <div className="px-4 py-3 border-b border-[#E5E5E5]">
                    <span className="text-[12px] font-semibold text-[#10293F] uppercase tracking-wider">Neste artigo</span>
                  </div>
                  <nav className="px-3 py-2 space-y-0.5 max-h-[350px] overflow-y-auto">
                    {tocHeadings.map((h) => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                        className={cn(
                          'block px-3 py-1.5 rounded-md text-[12px] transition-colors border-l-2',
                          h.level === 3 ? 'ml-3' : '',
                          activeHeading === h.id
                            ? 'border-l-[#45E5E5] text-[#10293F] font-semibold bg-[#E8F9F9]'
                            : 'border-l-transparent text-[#666] hover:text-[#10293F] hover:bg-[#F8FAFC]'
                        )}
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}
            </aside>
          )}

          {/* Mobile TOC dropdown */}
          {tocHeadings.length > 0 && (
            <div className="lg:hidden">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#10293F]"
              >
                <span>Indice do artigo</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', tocOpen && 'rotate-180')} />
              </button>
              {tocOpen && (
                <div className="mt-1 bg-white border border-[#E5E5E5] rounded-xl p-3 space-y-1">
                  {tocHeadings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        setTocOpen(false)
                        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={cn(
                        'block px-3 py-1.5 rounded-md text-[13px] text-[#666] hover:text-[#10293F] hover:bg-[#F8FAFC] transition-colors',
                        h.level === 3 && 'ml-4'
                      )}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CENTER: Article */}
          <article className="min-w-0" ref={contentRef}>
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(16,41,63,0.06)' }}>
              {/* Metadata bar */}
              <div className="px-6 md:px-8 pt-6 md:pt-8 pb-5">
                {hasSteps && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F9F9] text-[#10293F] text-xs font-semibold mb-3">
                    Passo {currentStep + 1} de {totalSteps}
                  </span>
                )}

                <h1 className="font-[Poppins,sans-serif] text-xl lg:text-2xl font-bold text-[#10293F] leading-tight mb-3">
                  {item.title}
                </h1>

                {item.description && (
                  <p className="text-[#666] text-[15px] leading-relaxed mb-4">{item.description}</p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#666]">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', levelConfig.bg, levelConfig.color)}>
                    {levelConfig.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(item.duration_seconds)}
                  </span>
                  {item.updated_at && (
                    <span className="flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" />
                      {formatDate(item.updated_at)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {item.usage_count ?? 0} visualizacoes
                  </span>
                </div>
              </div>

              {/* Video embed */}
              {item.video_url && (
                <div className="px-6 md:px-8 mb-6">
                  <div className="rounded-xl overflow-hidden border border-[#E5E5E5] aspect-video">
                    <iframe
                      src={item.video_url.replace('watch?v=', 'embed/')}
                      title={item.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Thumbnail if no video */}
              {!item.video_url && (item.thumbnail_url || item.media_url) && (
                <div className="px-6 md:px-8 mb-6">
                  <div className="rounded-xl overflow-hidden border border-[#E5E5E5]">
                    <img
                      src={item.thumbnail_url || item.media_url || ''}
                      alt={item.title}
                      className="w-full h-auto object-cover max-h-72"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>
                </div>
              )}

              {/* Content body */}
              <div className="px-6 md:px-8 pb-6">
                {processedContent ? (
                  <div
                    className="prose prose-sm max-w-none text-[#333] leading-relaxed
                      [&_h2]:font-[Poppins,sans-serif] [&_h2]:text-[#10293F] [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:scroll-mt-20
                      [&_h3]:font-[Poppins,sans-serif] [&_h3]:text-[#10293F] [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:scroll-mt-20
                      [&_p]:mb-4 [&_p]:text-[15px] [&_p]:leading-relaxed
                      [&_ul]:mb-4 [&_ul]:pl-5 [&_li]:text-[15px] [&_li]:mb-1
                      [&_ol]:mb-4 [&_ol]:pl-5
                      [&_a]:text-[#45E5E5] [&_a]:underline [&_a]:underline-offset-2
                      [&_img]:rounded-xl [&_img]:border [&_img]:border-[#E5E5E5] [&_img]:my-4
                      [&_code]:bg-[#F5F5F5] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]
                      [&_pre]:bg-[#10293F] [&_pre]:text-white/90 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto
                      [&_blockquote]:border-l-[3px] [&_blockquote]:border-[#45E5E5] [&_blockquote]:pl-4 [&_blockquote]:text-[#666] [&_blockquote]:italic
                      [&_table]:w-full [&_table]:border-collapse [&_th]:bg-[#10293F] [&_th]:text-white [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:text-[12px]
                      [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-[#F0F0F0] [&_td]:text-[13px]"
                    dangerouslySetInnerHTML={{ __html: processedContent }}
                  />
                ) : (
                  <p className="text-[#666] text-[15px]">Conteudo nao disponivel.</p>
                )}

                {/* Tip box */}
                <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-[#E8F9F9] border border-[rgba(69,229,229,0.3)]">
                  <Lightbulb className="w-5 h-5 text-[#10293F] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#10293F] mb-0.5">Dica</p>
                    <p className="text-sm text-[#444]">
                      {item.description || 'Consulte a base de conhecimento para mais detalhes.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback section */}
              <div className="mx-6 md:mx-8 mb-6 p-5 rounded-xl bg-[#F8FAFC] border border-[#E5E5E5] text-center">
                <p className="font-semibold text-[#10293F] text-sm mb-3">Este artigo foi util?</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleFeedback(true)}
                    disabled={!!feedbackGiven}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[100px] justify-center',
                      feedbackGiven === 'up'
                        ? 'bg-[#16A34A] text-white'
                        : feedbackGiven
                        ? 'bg-[#F5F5F5] text-[#CCC] cursor-not-allowed'
                        : 'bg-white border border-[#E5E5E5] text-[#10293F] hover:border-[#16A34A] hover:bg-[#F0FDF4]'
                    )}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Sim
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    disabled={!!feedbackGiven}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[100px] justify-center',
                      feedbackGiven === 'down'
                        ? 'bg-[#DC2626] text-white'
                        : feedbackGiven
                        ? 'bg-[#F5F5F5] text-[#CCC] cursor-not-allowed'
                        : 'bg-white border border-[#E5E5E5] text-[#10293F] hover:border-[#DC2626] hover:bg-[#FEF2F2]'
                    )}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Nao
                  </button>
                </div>
                {feedbackGiven && (
                  <p className="text-xs text-[#666] mt-2">Obrigado pelo seu feedback!</p>
                )}
              </div>

              {/* CTA banner */}
              <div className="mx-6 md:mx-8 mb-6 rounded-xl bg-[#10293F] p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-[Poppins,sans-serif] font-semibold text-white text-base">Ficou com duvida?</p>
                  <p className="text-sm text-white/50 mt-0.5">Nosso assistente de IA pode ajudar.</p>
                </div>
                <button
                  onClick={() => {
                    const chatBtn = document.querySelector('[data-help-chat-trigger]') as HTMLButtonElement
                    chatBtn?.click()
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#45E5E5] text-[#10293F] font-semibold text-sm hover:bg-[#2ecece] transition-colors shrink-0"
                >
                  <Bot className="w-4 h-4" />
                  Perguntar a IA
                </button>
              </div>

              {/* Step navigation */}
              {hasSteps && (
                <div className="px-6 md:px-8 py-5 border-t border-[#E5E5E5] flex items-center justify-between gap-4">
                  <button
                    onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 0}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors',
                      currentStep === 0
                        ? 'border-[#E5E5E5] text-[#CCC] cursor-not-allowed'
                        : 'border-[#E5E5E5] text-[#444] hover:bg-[#F5F5F5]'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="text-sm font-semibold text-[#666]">{currentStep + 1} / {totalSteps}</span>
                  <button
                    onClick={() => currentStep < totalSteps - 1 && goToStep(currentStep + 1)}
                    disabled={currentStep === totalSteps - 1}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      currentStep === totalSteps - 1
                        ? 'bg-[#E5E5E5] text-[#CCC] cursor-not-allowed'
                        : 'bg-[#10293F] text-white hover:bg-[#1a3d5c]'
                    )}
                  >
                    Proximo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <div className="mt-8">
                <h3 className="font-[Poppins,sans-serif] font-bold text-[#10293F] text-lg mb-4">Artigos relacionados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {relatedArticles.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/help/manuals/${rel.id}`}
                      className="group flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl p-4 hover:border-[#45E5E5] hover:shadow-[0_4px_12px_rgba(16,41,63,0.08)] transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-[#10293F]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#333] line-clamp-2 group-hover:text-[#10293F]">{rel.title}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#CCC] group-hover:text-[#45E5E5] shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </main>

      <HelpFloatingChat />
    </div>
  )
}
