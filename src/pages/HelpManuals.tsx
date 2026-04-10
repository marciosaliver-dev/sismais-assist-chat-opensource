import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, BookOpen, ChevronRight, ArrowRight, SlidersHorizontal, X,
  ChevronLeft, Menu, Eye, ThumbsUp, Clock,
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

const ITEMS_PER_PAGE = 12

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  beginner: { label: 'Iniciante', color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', dot: 'bg-[#16A34A]' },
  intermediate: { label: 'Intermediario', color: 'text-[#FFB800]', bg: 'bg-[#FFFBEB]', dot: 'bg-[#FFB800]' },
  advanced: { label: 'Avancado', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', dot: 'bg-[#DC2626]' },
}

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced']

const SORT_OPTIONS = [
  { value: 'usage_count', label: 'Mais acessados' },
  { value: 'created_at', label: 'Mais recentes' },
  { value: 'title', label: 'A → Z' },
] as const

type SortBy = (typeof SORT_OPTIONS)[number]['value']

const THUMB_GRADIENTS = [
  'from-[#10293F] to-[#1a3d5c]',
  'from-[#0f4c5c] to-[#10293F]',
  'from-[#1a3d5c] to-[#28a8a8]',
  'from-[#10293F] to-[#7C3AED]',
  'from-[#10293F] to-[#2563EB]',
  'from-[#1e3f5a] to-[#10293F]',
]

function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
}

function approvalPercent(item: PublicKnowledgeItem) {
  const total = item.helpful_count + item.not_helpful_count
  if (total === 0) return null
  return Math.round((item.helpful_count / total) * 100)
}

function readTime(seconds: number | null) {
  if (!seconds) return '~5 min'
  return `~${Math.ceil(seconds / 60)} min`
}

export default function HelpManuals() {
  const [searchParams] = useSearchParams()
  const initialProduct = searchParams.get('product')

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(initialProduct)
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('usage_count')
  const [currentPage, setCurrentPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { items: allItems, isLoading: itemsLoading } = usePublicKnowledge({})
  const { products, isLoading: productsLoading } = usePublicKnowledgeCategories()

  const manualItems = useMemo(
    () => allItems.filter((i) => i.source_type === 'manual' || i.content_type === 'text'),
    [allItems]
  )

  const productManualCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of manualItems) {
      if (item.product_id) counts[item.product_id] = (counts[item.product_id] || 0) + 1
    }
    return counts
  }, [manualItems])

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of manualItems) {
      const lvl = item.difficulty_level || 'beginner'
      counts[lvl] = (counts[lvl] || 0) + 1
    }
    return counts
  }, [manualItems])

  const filteredItems = useMemo(() => {
    let result = [...manualItems]
    if (selectedProduct) result = result.filter((i) => i.product_id === selectedProduct)
    if (selectedLevels.size > 0) result = result.filter((i) => selectedLevels.has(i.difficulty_level || 'beginner'))
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q))
      )
    }
    if (sortBy === 'usage_count') result.sort((a, b) => b.usage_count - a.usage_count)
    else if (sortBy === 'created_at') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else result.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return result
  }, [manualItems, selectedProduct, selectedLevels, searchQuery, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedItems = filteredItems.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE)

  function toggleLevel(level: string) {
    setSelectedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level); else next.add(level)
      return next
    })
    setCurrentPage(1)
  }

  function clearFilters() {
    setSelectedLevels(new Set())
    setSelectedProduct(null)
    setSearchQuery('')
    setCurrentPage(1)
  }

  const isLoading = itemsLoading || productsLoading
  const hasActiveFilters = selectedLevels.size > 0 || selectedProduct !== null

  // Sidebar content (reused for mobile and desktop)
  const sidebarContent = (
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(16,41,63,0.06)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <span className="text-[13px] font-semibold text-[#10293F]">Produtos</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-[11px] text-[#DC2626] hover:underline font-medium flex items-center gap-0.5">
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* All option */}
      <button
        onClick={() => { setSelectedProduct(null); setCurrentPage(1) }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors border-l-[3px]',
          !selectedProduct
            ? 'border-l-[#45E5E5] bg-[#E8F9F9] text-[#10293F] font-semibold'
            : 'border-l-transparent text-[#666] hover:bg-[#F8FAFC]'
        )}
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        <span className="flex-1">Todos</span>
        <span className="text-[11px] text-[#999]">{manualItems.length}</span>
      </button>

      {/* Product list */}
      {products.map((p) => {
        const count = productManualCounts[p.id] || 0
        const isActive = selectedProduct === p.id
        return (
          <button
            key={p.id}
            onClick={() => { setSelectedProduct(isActive ? null : p.id); setCurrentPage(1) }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors border-l-[3px]',
              isActive
                ? 'border-l-[#45E5E5] bg-[#E8F9F9] text-[#10293F] font-semibold'
                : 'border-l-transparent text-[#666] hover:bg-[#F8FAFC]'
            )}
          >
            <div
              className="w-4 h-4 rounded shrink-0"
              style={{ background: p.color || '#45E5E5' }}
            />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-[11px] text-[#999]">{count}</span>
          </button>
        )
      })}

      {/* Difficulty filter */}
      <div className="px-4 py-3 border-t border-[#E5E5E5]">
        <p className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-2.5">Nivel</p>
        <div className="flex flex-col gap-1.5">
          {LEVEL_ORDER.map((level) => {
            const config = LEVEL_CONFIG[level]
            const count = levelCounts[level] || 0
            const isChecked = selectedLevels.has(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors',
                  isChecked ? `${config.bg} font-medium` : 'hover:bg-[#F8FAFC]'
                )}
              >
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', config.dot)} />
                <span className={cn('flex-1 text-left', isChecked ? config.color : 'text-[#666]')}>
                  {config.label}
                </span>
                <span className="text-[11px] text-[#999]">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <HelpHeader />

      {/* Page Header */}
      <div className="bg-[#10293F]" style={{ padding: '32px 20px 40px' }}>
        <div className="max-w-[1060px] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[13px] mb-4">
            <Link to="/help-center" className="text-white/45 hover:text-white/70 transition-colors">Inicio</Link>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            <span className="text-white font-medium">Manuais</span>
          </div>

          <h1 className="font-[Poppins,sans-serif] text-2xl font-bold text-white mb-1.5">
            Biblioteca de Manuais
          </h1>
          <p className="text-white/60 text-[14px] mb-5">
            {manualItems.length} guias detalhados para usar o GMS com facilidade
          </p>

          {/* Search */}
          <div className="relative max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              placeholder="Buscar manuais por titulo ou descricao..."
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/10 text-white placeholder:text-white/35 text-[14px] border border-white/10 outline-none focus:border-[#45E5E5]/50 focus:bg-white/[0.12] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-[#E5E5E5] sticky top-[52px] z-30">
        <div className="max-w-[1060px] mx-auto px-5 flex items-center justify-between h-11">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-1.5 text-[13px] text-[#666] font-medium"
            aria-label="Filtros"
          >
            <Menu className="w-4 h-4" />
            Filtros
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#45E5E5]" />}
          </button>

          {/* Difficulty pills (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            {LEVEL_ORDER.map((level) => {
              const config = LEVEL_CONFIG[level]
              const isActive = selectedLevels.has(level)
              return (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors',
                    isActive
                      ? `${config.bg} ${config.color} border-transparent`
                      : 'bg-white text-[#666] border-[#E5E5E5] hover:border-[#CCC]'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', config.dot)} />
                  {config.label}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#999]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-[12px] text-[#666] bg-transparent border-none outline-none cursor-pointer font-medium"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main: sidebar + grid */}
      <main className="flex-1 max-w-[1060px] mx-auto w-full px-5 py-6">
        <div className="flex gap-6">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block w-[220px] shrink-0 sticky top-[110px] self-start">
            {sidebarContent}
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-[rgba(16,41,63,0.5)]" onClick={() => setSidebarOpen(false)} />
              <div className="relative w-[280px] max-w-[85vw] bg-[#F8FAFC] p-4 overflow-y-auto animate-[slideIn_200ms_ease]">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-[#10293F] text-sm">Filtros</span>
                  <button onClick={() => setSidebarOpen(false)} aria-label="Fechar filtros">
                    <X className="w-5 h-5 text-[#666]" />
                  </button>
                </div>
                {sidebarContent}
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#666]">
                <span className="font-semibold text-[#10293F]">{filteredItems.length}</span>{' '}
                resultado{filteredItems.length !== 1 ? 's' : ''}
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[260px] rounded-xl" />
                ))}
              </div>
            ) : paginatedItems.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#E8F9F9] flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-[#10293F]/50" />
                </div>
                <h3 className="font-semibold font-[Poppins,sans-serif] text-[#10293F] text-base mb-1">
                  Nenhum manual encontrado
                </h3>
                <p className="text-[#666] text-[13px] max-w-xs mb-4">
                  {searchQuery ? 'Tente outros termos na busca.' : 'Nao ha manuais nesta categoria ainda.'}
                </p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-[#45E5E5] text-sm font-medium hover:underline">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedItems.map((item, idx) => (
                  <ManualCard key={item.id} item={item} gradientIndex={idx} products={products} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#666] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-[13px] font-medium transition-all',
                      safeCurrentPage === i + 1
                        ? 'bg-[#10293F] text-white'
                        : 'text-[#666] hover:bg-[#F5F5F5]'
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#666] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Proxima pagina"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <HelpFloatingChat />

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

/* ---- Manual Card ---- */

interface ManualCardProps {
  item: PublicKnowledgeItem
  gradientIndex: number
  products: { id: string; name: string; color: string | null }[]
}

function ManualCard({ item, gradientIndex, products }: ManualCardProps) {
  const gradient = THUMB_GRADIENTS[gradientIndex % THUMB_GRADIENTS.length]
  const product = products.find((p) => p.id === item.product_id)
  const approval = approvalPercent(item)
  const levelConfig = LEVEL_CONFIG[item.difficulty_level || 'beginner'] || LEVEL_CONFIG.beginner

  return (
    <Link
      to={`/help/manuals/${item.id}`}
      className="group bg-white rounded-xl border border-[#E5E5E5] overflow-hidden hover:shadow-[0_6px_20px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      {/* Thumbnail */}
      <div className={cn('relative h-[90px] bg-gradient-to-br flex items-center justify-center overflow-hidden', gradient)}>
        <BookOpen className="w-10 h-10 text-white/10" />

        {/* New badge */}
        {isNew(item.created_at) && (
          <span className="absolute top-2.5 left-2.5 bg-[#FFB800] text-[#10293F] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Novo
          </span>
        )}

        {/* Difficulty pill */}
        <span className={cn(
          'absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
          levelConfig.bg, levelConfig.color
        )}>
          {levelConfig.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Category */}
        {(product || item.category) && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#45E5E5] mb-1.5">
            {product?.name || item.category}
          </span>
        )}

        {/* Title */}
        <h3 className="font-[Poppins,sans-serif] font-bold text-[14px] text-[#10293F] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#1a3d5c] transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description && (
          <p className="text-[12px] text-[#666] leading-relaxed line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-[#F0F0F0]">
          <div className="flex items-center gap-3 text-[11px] text-[#999]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readTime(item.duration_seconds)}
            </span>
            {approval !== null && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {approval}%
              </span>
            )}
          </div>

          <span className="w-7 h-7 rounded-lg bg-[#F5F5F5] text-[#999] flex items-center justify-center group-hover:bg-[#45E5E5] group-hover:text-[#10293F] transition-all">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
