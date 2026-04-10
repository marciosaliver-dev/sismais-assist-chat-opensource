import { useState, useCallback } from 'react'
import { BookOpen, AlertCircle, GraduationCap, X } from 'lucide-react'
import { useManualArticles } from '@/hooks/useManualArticles'
import { ManualSearchBar } from '@/components/manual/ManualSearchBar'
import { ManualModuleCard } from '@/components/manual/ManualModuleCard'
import { ManualArticleCard } from '@/components/manual/ManualArticleCard'

export default function ManualHome() {
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  const { articles, products, isLoading, error, refetch } = useManualArticles({
    productId: selectedProduct,
    search,
  })

  const handleSearch = useCallback((term: string) => {
    setSearch(term)
  }, [])

  const handleModuleClick = (productId: string) => {
    setSelectedProduct((prev) => (prev === productId ? undefined : productId))
  }

  const isSearching = search.trim().length > 0

  const selectedProductName = selectedProduct
    ? products.find((p) => p.id === selectedProduct)?.name
    : undefined

  let articleSectionLabel = 'Todos os manuais'
  if (selectedProductName && !isSearching) {
    articleSectionLabel = `Manuais — ${selectedProductName}`
  } else if (isSearching) {
    articleSectionLabel = `Resultados para "${search}"`
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero Header */}
      <div
        className="relative flex flex-col items-center justify-center px-4 py-12 gap-4 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #10293F 0%, #1a3d5c 100%)',
          minHeight: '220px',
        }}
      >
        {/* Padrão decorativo sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Badge interno */}
        <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white/80 bg-white/10 border border-white/15">
          <GraduationCap size={13} />
          Treinamento Interno
        </span>

        {/* Titulo */}
        <div className="relative flex items-center gap-3">
          <BookOpen size={34} className="text-[#45E5E5]" />
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}
          >
            Central de Manuais
          </h1>
        </div>

        {/* Subtitulo + stats */}
        <p className="relative text-sm text-white/60">
          Aprenda a usar cada recurso do sistema
          {!isLoading && articles.length > 0 && (
            <span className="ml-2 text-white/40">
              — {articles.length} {articles.length === 1 ? 'manual' : 'manuais'} em {products.length} {products.length === 1 ? 'módulo' : 'módulos'}
            </span>
          )}
        </p>

        {/* Search */}
        <div className="relative mt-2">
          <ManualSearchBar onSearch={handleSearch} />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
          <AlertCircle size={40} className="text-[#DC2626]" />
          <p className="text-base font-medium text-[#333333]">
            Erro ao carregar manuais
          </p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!error && (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* Module Grid */}
          {!isSearching && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#45E5E5]" />
                <h2
                  className="text-base font-semibold text-[#10293F]"
                  style={{ fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}
                >
                  Módulos
                </h2>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[88px] rounded-xl animate-pulse bg-[#E5E5E5]"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <ManualModuleCard
                      key={product.id}
                      name={product.name}
                      icon={product.icon}
                      color={product.color}
                      articleCount={product.article_count}
                      isActive={selectedProduct === product.id}
                      onClick={() => handleModuleClick(product.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Filter chip */}
          {selectedProduct && !isSearching && (
            <div>
              <button
                onClick={() => setSelectedProduct(undefined)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece] transition-colors"
              >
                <X size={14} />
                Limpar filtro
              </button>
            </div>
          )}

          {/* Article Grid */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#45E5E5]" />
              <h2
                className="text-base font-semibold text-[#10293F]"
                style={{ fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}
              >
                {articleSectionLabel}
                {!isLoading && (
                  <span className="ml-2 text-sm font-normal text-[#999]">
                    ({articles.length})
                  </span>
                )}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[100px] rounded-xl animate-pulse bg-[#E5E5E5]"
                  />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="w-20 h-20 rounded-full bg-[#E8F9F9] flex items-center justify-center">
                  <BookOpen size={36} className="text-[#10293F]/40" />
                </div>
                {isSearching ? (
                  <>
                    <p className="text-sm text-[#666666]">
                      Nenhum resultado encontrado para "<span className="font-semibold text-[#10293F]">{search}</span>"
                    </p>
                    <button
                      onClick={() => setSearch('')}
                      className="text-sm font-medium text-[#45E5E5] hover:underline"
                    >
                      Limpar busca
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-[#666666]">
                    Nenhum manual disponível ainda
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map((article) => (
                  <ManualArticleCard
                    key={article.id}
                    id={article.id}
                    title={article.title}
                    description={article.description}
                    contentHtml={article.content_html || article.content || ''}
                    tags={article.tags}
                    productName={article.product_name}
                    productColor={article.product_color}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
