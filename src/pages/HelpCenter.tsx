import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Loader2, BookOpen, ChevronRight, ArrowRight, Sparkles,
  ShieldCheck, Phone, Mail, BookText, PlayCircle, Headphones,
  TrendingUp, Clock, Eye, Star, Bot, MessageSquare,
} from 'lucide-react'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { usePublicKnowledge, usePublicKnowledgeCategories } from '@/hooks/usePublicKnowledge'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

const SEARCH_PLACEHOLDERS = [
  'Como emitir nota fiscal...',
  'Cadastrar cliente novo...',
  'Gerar relatório financeiro...',
  'Configurar boleto bancário...',
]

const QUICK_PILLS = [
  { label: 'Mais acessados', icon: TrendingUp },
  { label: 'Vídeos', icon: PlayCircle },
  { label: 'Novidades', icon: Star },
]

export default function HelpCenter() {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { products: categories, isLoading: categoriesLoading } = usePublicKnowledgeCategories()
  const { items: featuredItems, isLoading: featuredLoading } = usePublicKnowledge({ limit: 8 })
  const { items: searchResults, isLoading: searchLoading } = usePublicKnowledge({
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    limit: 5,
  })

  // Cycle placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    setSearchOpen(debouncedSearch.length >= 2)
  }, [debouncedSearch])

  const popularItems = [...featuredItems]
    .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
    .slice(0, 6)

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <HelpHeader />

      {/* ---- Hero Section ---- */}
      <section className="relative bg-[#10293F] overflow-hidden">
        {/* Decorative gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(69,229,229,0.12)_0%,transparent_60%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#10293F] to-transparent" />

        <div className="relative max-w-3xl mx-auto px-5 pt-14 pb-16 md:pt-20 md:pb-20 text-center">
          {/* Greeting */}
          <div className="inline-flex items-center gap-2.5 mb-6">
            <span className="text-3xl md:text-4xl animate-[wave_2s_ease-in-out_infinite]" role="img" aria-label="acenando">
              {'\u{1F44B}'}
            </span>
            <span className="text-white/70 text-lg md:text-xl font-medium">
              Ola! Como podemos te ajudar?
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold font-[Poppins,sans-serif] text-white leading-tight mb-3">
            Central de{' '}
            <span className="text-[#45E5E5]">Ajuda GMS</span>
          </h1>
          <p className="text-white/50 text-sm md:text-base mb-8 max-w-md mx-auto">
            Manuais, videos e suporte para usar o sistema com facilidade.
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto" ref={searchRef}>
            <div className="relative flex items-center">
              {searchLoading && debouncedSearch.length >= 2 ? (
                <Loader2 className="absolute left-4 w-5 h-5 text-white/40 animate-spin" />
              ) : (
                <Search className="absolute left-4 w-5 h-5 text-white/40" />
              )}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => debouncedSearch.length >= 2 && setSearchOpen(true)}
                placeholder={SEARCH_PLACEHOLDERS[placeholderIdx]}
                className="w-full h-14 pl-12 pr-14 rounded-2xl bg-white/10 border border-white/15 text-white placeholder:text-white/35 text-base outline-none focus:border-[#45E5E5]/60 focus:bg-white/[0.12] transition-all duration-200"
              />
              <button
                aria-label="Buscar"
                className="absolute right-2 w-10 h-10 rounded-xl bg-[#45E5E5] text-[#10293F] flex items-center justify-center hover:bg-[#2ecece] transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick pills */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              {QUICK_PILLS.map((pill) => {
                const Icon = pill.icon
                return (
                  <button
                    key={pill.label}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 transition-colors"
                  >
                    <Icon className="w-3 h-3" />
                    {pill.label}
                  </button>
                )
              })}
            </div>

            {/* Search dropdown */}
            {searchOpen && debouncedSearch.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-[#E5E5E5] overflow-hidden z-50" style={{ boxShadow: '0 10px 40px rgba(16,41,63,0.2)' }}>
                {searchResults.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <Search className="w-8 h-8 text-[#CCC] mx-auto mb-2" />
                    <p className="text-sm text-[#666]">Nenhum resultado para "<strong>{debouncedSearch}</strong>"</p>
                    <p className="text-xs text-[#999] mt-1">Tente termos diferentes ou navegue pelas categorias.</p>
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <Link
                      key={result.id}
                      to={result.source_type === 'manual' ? `/help/manuals/${result.id}` : `/help/content/${result.id}`}
                      onClick={() => { setSearch(''); setSearchOpen(false) }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors border-b border-[#F0F0F0] last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0">
                        {result.content_type === 'video' ? (
                          <PlayCircle className="w-4 h-4 text-[#10293F]" />
                        ) : (
                          <BookOpen className="w-4 h-4 text-[#10293F]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#333] font-medium truncate">{result.title}</p>
                        {result.description && (
                          <p className="text-xs text-[#999] truncate">{result.description}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#CCC] shrink-0" />
                    </Link>
                  ))
                )}
                {searchResults.length > 0 && (
                  <Link
                    to={`/help/content?search=${encodeURIComponent(debouncedSearch)}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-center px-4 py-2.5 text-xs text-[#45E5E5] font-semibold hover:bg-[#E8F9F9] transition-colors"
                  >
                    Ver todos os resultados
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* ---- Action Cards 2x2 ---- */}
        <section className="max-w-[960px] mx-auto px-5 py-10 md:py-14">
          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold font-[Poppins,sans-serif] text-[#10293F] mb-1">
              O que voce precisa?
            </h2>
            <p className="text-[#666] text-sm">Escolha uma opcao para comecar</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {/* Manuais */}
            <Link
              to="/help/manuals"
              className="group relative rounded-xl border border-[#E5E5E5] bg-white p-5 md:p-6 hover:shadow-[0_8px_24px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border-l-[3px] border-l-[#45E5E5]"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8F9F9] flex items-center justify-center mb-4">
                <BookText className="w-6 h-6 text-[#10293F]" />
              </div>
              <h3 className="text-lg font-bold font-[Poppins,sans-serif] text-[#10293F] mb-1">Manuais</h3>
              <p className="text-sm text-[#666] mb-4 leading-relaxed">Passo a passo para usar o sistema com facilidade.</p>
              <ArrowRight className="w-5 h-5 text-[#CCC] group-hover:text-[#45E5E5] group-hover:translate-x-1 transition-all absolute bottom-5 right-5 md:bottom-6 md:right-6" />
            </Link>

            {/* Videos */}
            <Link
              to="/help/videos"
              className="group relative rounded-xl border border-[#E5E5E5] bg-white p-5 md:p-6 hover:shadow-[0_8px_24px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border-l-[3px] border-l-[#45E5E5]"
            >
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <PlayCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold font-[Poppins,sans-serif] text-[#10293F] mb-1">Videos</h3>
              <p className="text-sm text-[#666] mb-4 leading-relaxed">Tutoriais em video para aprender visualmente.</p>
              <ArrowRight className="w-5 h-5 text-[#CCC] group-hover:text-[#45E5E5] group-hover:translate-x-1 transition-all absolute bottom-5 right-5 md:bottom-6 md:right-6" />
            </Link>

            {/* Falar com Suporte */}
            <Link
              to="/help/tickets/new"
              className="group relative rounded-xl border border-[#E5E5E5] bg-white p-5 md:p-6 hover:shadow-[0_8px_24px_rgba(16,41,63,0.1)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border-l-[3px] border-l-[#45E5E5]"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold font-[Poppins,sans-serif] text-[#10293F] mb-1">Falar com Suporte</h3>
              <p className="text-sm text-[#666] mb-4 leading-relaxed">Atendimento humano para duvidas complexas.</p>
              <ArrowRight className="w-5 h-5 text-[#CCC] group-hover:text-[#45E5E5] group-hover:translate-x-1 transition-all absolute bottom-5 right-5 md:bottom-6 md:right-6" />
            </Link>

            {/* Perguntar para IA (dark card) */}
            <button
              onClick={() => {
                const chatBtn = document.querySelector('[data-help-chat-trigger]') as HTMLButtonElement
                chatBtn?.click()
              }}
              className="group relative rounded-xl border border-transparent bg-[#10293F] p-5 md:p-6 hover:shadow-[0_8px_24px_rgba(16,41,63,0.25)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden text-left border-l-[3px] border-l-[#45E5E5]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[rgba(69,229,229,0.15)] flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#45E5E5]" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[rgba(69,229,229,0.15)] text-[#45E5E5] text-[10px] font-bold tracking-wider uppercase">
                  Instantaneo
                </span>
              </div>
              <h3 className="text-lg font-bold font-[Poppins,sans-serif] text-white mb-1">Perguntar para IA</h3>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">Resposta instantanea sobre o sistema.</p>
              <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-[#45E5E5] group-hover:translate-x-1 transition-all absolute bottom-5 right-5 md:bottom-6 md:right-6" />
            </button>
          </div>
        </section>

        {/* ---- Mais acessados ---- */}
        {popularItems.length > 0 && (
          <section className="max-w-[960px] mx-auto px-5 pb-10 md:pb-14">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#10293F]" />
              </div>
              <h2 className="text-xl font-bold font-[Poppins,sans-serif] text-[#10293F]">Mais acessados esta semana</h2>
            </div>

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0">
              {popularItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.source_type === 'manual' ? `/help/manuals/${item.id}` : `/help/content/${item.id}`}
                  className="group flex items-center gap-3.5 bg-white border border-[#E5E5E5] rounded-xl p-4 hover:border-[#45E5E5] hover:shadow-[0_4px_12px_rgba(16,41,63,0.08)] transition-all duration-200 min-w-[260px] sm:min-w-0 shrink-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#E8F9F9] flex items-center justify-center shrink-0">
                    {item.content_type === 'video' ? (
                      <PlayCircle className="w-5 h-5 text-[#10293F]" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-[#10293F]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#333] truncate group-hover:text-[#10293F]">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Eye className="w-3 h-3 text-[#CCC]" />
                      <span className="text-xs text-[#999]">{item.usage_count ?? 0} acessos</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#CCC] group-hover:text-[#45E5E5] shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- Categories grid ---- */}
        {categories.length > 0 && (
          <section className="max-w-[960px] mx-auto px-5 pb-10 md:pb-14">
            <h2 className="text-xl font-bold font-[Poppins,sans-serif] text-[#10293F] mb-6">Categorias</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/help/manuals?product=${cat.id}`}
                  className="group flex flex-col items-center gap-2.5 bg-white border border-[#E5E5E5] rounded-xl p-5 hover:border-[#45E5E5] hover:shadow-[0_4px_12px_rgba(16,41,63,0.08)] hover:-translate-y-0.5 transition-all duration-200 text-center"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: cat.color ? `${cat.color}15` : '#E8F9F9' }}
                  >
                    <BookOpen className="w-5 h-5" style={{ color: cat.color || '#10293F' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#10293F]">{cat.name}</p>
                    <p className="text-xs text-[#999] mt-0.5">{cat.contentCount} artigos</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- Support Banner ---- */}
        <section className="max-w-[960px] mx-auto px-5 pb-10 md:pb-14">
          <div className="bg-[#10293F] rounded-2xl p-6 md:p-10 flex flex-col md:flex-row items-center gap-5 md:gap-8">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(69,229,229,0.15)] flex items-center justify-center shrink-0">
              <Headphones className="w-7 h-7 text-[#45E5E5]" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg md:text-xl font-bold font-[Poppins,sans-serif] text-white mb-1">
                Nao encontrou o que procurava?
              </h3>
              <p className="text-white/50 text-sm">
                Nosso suporte funciona de segunda a sexta, das 08:00 as 18:00.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button className="flex items-center gap-2 h-10 px-5 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors">
                <Phone className="w-4 h-4" />
                Ligar
              </button>
              <Link
                to="/help/tickets/new"
                className="flex items-center gap-2 h-10 px-5 rounded-lg bg-[#45E5E5] text-[#10293F] text-sm font-semibold hover:bg-[#2ecece] transition-colors"
              >
                <Mail className="w-4 h-4" />
                Abrir Chamado
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#E5E5E5] bg-white py-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#666]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="tracking-wider uppercase font-medium">Ambiente seguro e criptografado</span>
          </div>
          <p className="text-xs text-[#999]">
            © 2026 GMS — Gestao Mais Simples - Central de Ajuda
          </p>
        </div>
      </footer>

      <HelpFloatingChat />

      {/* Wave animation keyframes */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-8deg); }
          40% { transform: rotate(14deg); }
          50% { transform: rotate(-4deg); }
          60% { transform: rotate(10deg); }
          70% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
