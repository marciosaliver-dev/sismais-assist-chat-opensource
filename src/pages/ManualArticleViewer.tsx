import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, AlertCircle, BookOpen } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useManualArticle, useManualArticles, useManualFeedback } from '@/hooks/useManualArticles'
import { parseSteps, estimateReadingTime } from '@/lib/parseSteps'
import { ManualStepBlock } from '@/components/manual/ManualStepBlock'
import { ManualProgressBar } from '@/components/manual/ManualProgressBar'
import { ManualTableOfContents } from '@/components/manual/ManualTableOfContents'
import { Spinner } from '@/components/ui/spinner'

const DIFFICULTY_MAP: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

export default function ManualArticleViewer() {
  const { id } = useParams<{ id: string }>()

  const { data: article, isLoading, error } = useManualArticle(id)
  const { articles } = useManualArticles({ productId: article?.group_id ?? undefined })
  const feedbackMutation = useManualFeedback()

  const [activeStep, setActiveStep] = useState(0)
  const [feedbackDone, setFeedbackDone] = useState(false)

  useEffect(() => {
    if (!id) return
    const stored = localStorage.getItem(`manual_feedback_${id}`)
    if (stored !== null) setFeedbackDone(true)
  }, [id])

  const html = article?.content_html || article?.content || ''
  const steps = html ? parseSteps(html) : null
  const totalSteps = steps?.length ?? 0

  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const setStepRef = useCallback((el: HTMLDivElement | null, index: number) => {
    stepRefs.current[index] = el
  }, [])

  useEffect(() => {
    if (!steps || steps.length === 0) return
    const observers: IntersectionObserver[] = []
    steps.forEach((_, index) => {
      const el = stepRefs.current[index]
      if (!el) return
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => { if (entry.isIntersecting) setActiveStep(index) })
        },
        { rootMargin: '-20% 0px -60% 0px' }
      )
      observer.observe(el)
      observers.push(observer)
    })
    return () => { observers.forEach((obs) => obs.disconnect()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps?.length])

  const handleStepClick = (index: number) => {
    stepRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFeedback = (helpful: boolean) => {
    if (!id || feedbackDone) return
    feedbackMutation.mutate({ id, helpful })
    localStorage.setItem(`manual_feedback_${id}`, String(helpful))
    setFeedbackDone(true)
  }

  const currentIndex = articles.findIndex((a) => a.id === id)
  const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null
  const nextArticle = currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-[#DC2626]" />
        <p className="text-lg font-semibold text-[#10293F]">Erro ao carregar o artigo</p>
        <Link to="/manual" className="text-sm font-medium text-[#45E5E5] hover:underline">
          ← Voltar ao Manual
        </Link>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold text-[#10293F]">Artigo não encontrado</p>
        <Link to="/manual" className="text-sm font-medium text-[#45E5E5] hover:underline">
          ← Voltar ao Manual
        </Link>
      </div>
    )
  }

  const readingTime = estimateReadingTime(html)
  const tags: string[] = Array.isArray(article.tags) ? (article.tags as string[]) : []
  const difficultyTag = tags.find((t) => DIFFICULTY_MAP[t])
  const difficulty = difficultyTag ? DIFFICULTY_MAP[difficultyTag] : null
  const productName = (article as Record<string, unknown>).product_name as string | undefined
  // Content is sanitized via DOMPurify before any DOM insertion
  const sanitizedHtml = DOMPurify.sanitize(html)

  return (
    <div className="min-h-full">
      {steps && steps.length > 0 && (
        <ManualProgressBar currentStep={activeStep + 1} totalSteps={totalSteps} title={article.title} />
      )}

      <div className="flex gap-8 max-w-5xl mx-auto px-6 py-8">
        <main className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-6 text-sm" aria-label="Breadcrumb">
            <Link to="/manual" className="text-[#45E5E5] hover:underline">Manuais</Link>
            {productName && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-[#CCC]" />
                <span className="text-muted-foreground">{productName}</span>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-[#CCC]" />
            <span className="text-foreground font-medium truncate max-w-[300px]">{article.title}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            <h1 className="text-[22px] font-bold text-[#10293F] font-[Poppins] leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {productName && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.4)]">
                  {productName}
                </span>
              )}
              {difficulty && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] text-[#444] border border-[#E5E5E5]">
                  {difficulty}
                </span>
              )}
              {steps && steps.length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] text-[#444] border border-[#E5E5E5]">
                  {steps.length} passo{steps.length !== 1 ? 's' : ''}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] text-[#666] border border-[#E5E5E5]">
                ~{readingTime} min
              </span>
            </div>
            <div className="mt-4 border-b border-border" />
          </header>

          {/* Steps or continuous content */}
          {steps && steps.length > 0 ? (
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => (
                <ManualStepBlock
                  key={index}
                  ref={(el) => setStepRef(el, index)}
                  stepNumber={index + 1}
                  title={step.title}
                  content={step.content}
                  isActive={activeStep === index}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          ) : sanitizedHtml ? (
            <div
              className="prose prose-sm max-w-none text-[#333] [&_img]:rounded-lg [&_img]:shadow-md [&_img]:border [&_img]:border-[#E5E5E5]"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Este artigo não possui conteúdo disponível.</p>
          )}

          {/* Feedback */}
          <div className="mt-12 rounded-xl border border-border bg-card p-6 text-center">
            {feedbackDone ? (
              <p className="text-sm font-semibold text-[#16A34A]">Obrigado pelo seu feedback! 🎉</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#10293F] mb-3">Este artigo foi útil?</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-[#F0FDF4] hover:border-[#16A34A] transition-all text-sm"
                    aria-label="Marcar como útil"
                  >
                    <ThumbsUp className="h-4 w-4" /> Sim
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-[#FEF2F2] hover:border-[#DC2626] transition-all text-sm"
                    aria-label="Marcar como não útil"
                  >
                    <ThumbsDown className="h-4 w-4" /> Não
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Prev/Next */}
          {(prevArticle || nextArticle) && (
            <div className="flex gap-4 mt-8">
              {prevArticle ? (
                <Link
                  to={`/manual/${prevArticle.id}`}
                  className="flex-1 flex items-center gap-3 p-4 rounded-xl border border-border hover:border-[#45E5E5] hover:bg-[#E8F9F9] transition-all"
                >
                  <ArrowLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Anterior</p>
                    <p className="text-sm font-medium text-[#10293F] truncate">{prevArticle.title}</p>
                  </div>
                </Link>
              ) : <div className="flex-1" />}
              {nextArticle ? (
                <Link
                  to={`/manual/${nextArticle.id}`}
                  className="flex-1 flex items-center justify-end gap-3 p-4 rounded-xl border border-border hover:border-[#45E5E5] hover:bg-[#E8F9F9] transition-all text-right"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Próximo</p>
                    <p className="text-sm font-medium text-[#10293F] truncate">{nextArticle.title}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </Link>
              ) : <div className="flex-1" />}
            </div>
          )}
        </main>

        {/* TOC sidebar */}
        {steps && steps.length > 0 && (
          <ManualTableOfContents steps={steps} activeStep={activeStep} onStepClick={handleStepClick} />
        )}
      </div>
    </div>
  )
}
