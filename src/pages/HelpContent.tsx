import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { HelpHeader } from '@/components/help/HelpHeader'
import { HelpFloatingChat } from '@/components/help/HelpFloatingChat'
import { HelpContentGrid } from '@/components/help/HelpContentGrid'
import { HelpSidebarFilters } from '@/components/help/HelpSidebarFilters'
import { usePublicKnowledge, usePublicKnowledgeCategories } from '@/hooks/usePublicKnowledge'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export default function HelpContent() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(searchParams.get('product') || null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(searchParams.get('type') || null)

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (selectedProductId) params.product = selectedProductId
    if (selectedType) params.type = selectedType
    setSearchParams(params, { replace: true })
  }, [search, selectedProductId, selectedType, setSearchParams])

  // Fetch categories for sidebar
  const { products: categories } = usePublicKnowledgeCategories()

  // Fetch groups for selected product
  const { data: groups = [] } = useQuery({
    queryKey: ['public-knowledge-groups', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return []
      const { data, error } = await supabase
        .from('knowledge_groups')
        .select('id, name, product_id')
        .eq('product_id', selectedProductId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!selectedProductId,
  })

  // Fetch filtered content
  const { items, isLoading } = usePublicKnowledge({
    productId: selectedProductId,
    groupId: selectedGroupId,
    contentType: selectedType,
    search: search.length >= 2 ? search : undefined,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
      <HelpHeader />

      <div className="max-w-6xl mx-auto w-full px-6 py-8 flex-1">
        {/* Title + Search */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">Todos os Conteúdos</h1>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conteúdos..."
              className="pl-10 pr-10 bg-white rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <HelpSidebarFilters
            products={categories}
            groups={groups}
            selectedProductId={selectedProductId}
            selectedGroupId={selectedGroupId}
            selectedType={selectedType}
            onSelectProduct={(id) => { setSelectedProductId(id); setSelectedGroupId(null) }}
            onSelectGroup={setSelectedGroupId}
            onSelectType={setSelectedType}
          />

          {/* Content Grid */}
          <div className="flex-1">
            <HelpContentGrid
              items={items}
              isLoading={isLoading}
              emptyMessage={search ? `Nenhum conteúdo encontrado para "${search}".` : 'Nenhum conteúdo disponível nesta categoria.'}
            />
          </div>
        </div>
      </div>

      <HelpFloatingChat />
    </div>
  )
}
