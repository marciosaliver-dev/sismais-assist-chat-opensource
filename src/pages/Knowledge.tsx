import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, BookOpen, Loader2, Sparkles, X, Download, Eye, Brain, Filter } from 'lucide-react'
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase'
import { useKnowledgeProducts, type KnowledgeProduct } from '@/hooks/useKnowledgeProducts'
import { useKnowledgeGroups } from '@/hooks/useKnowledgeGroups'
import { StatsCards } from '@/components/knowledge/StatsCards'
import { UploadDialog } from '@/components/knowledge/UploadDialog'
import { DocumentCard } from '@/components/knowledge/DocumentCard'
import { DocumentPreview } from '@/components/knowledge/DocumentPreview'
import { HierarchySidebar } from '@/components/knowledge/HierarchySidebar'
import { ProductFormDialog } from '@/components/knowledge/ProductFormDialog'
import { ProductManagerDialog } from '@/components/knowledge/ProductManagerDialog'
import { AdvancedFilters } from '@/components/knowledge/AdvancedFilters'
import { GroupManagerDialog } from '@/components/knowledge/GroupManagerDialog'
import { ImportZohoDeskDialog } from '@/components/knowledge/ImportZohoDeskDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Tables } from '@/integrations/supabase/types'

type KnowledgeDoc = Tables<'ai_knowledge_base'>

const VISIBILITY_FILTERS = [
  { value: 'all', label: 'Todos', icon: Filter },
  { value: 'public', label: 'Público', icon: Eye },
  { value: 'ai', label: 'IA (RAG)', icon: Brain },
  { value: 'both', label: 'Público + IA', icon: Sparkles },
]

export default function Knowledge() {
  const {
    documents, stats, isLoading, deleteDocument, voteDocument,
    semanticSearch, semanticResults, isSearching, clearSemanticResults
  } = useKnowledgeBase()
  const { products, isLoading: productsLoading, createProduct, updateProduct, deleteProduct } = useKnowledgeProducts()
  const { groups, isLoading: groupsLoading, createGroup, updateGroup, deleteGroup } = useKnowledgeGroups(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [isSemanticMode, setIsSemanticMode] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Product/group selection
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // Dialog states
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<KnowledgeProduct | null>(null)
  const [productManagerOpen, setProductManagerOpen] = useState(false)
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [groupManagerProductId, setGroupManagerProductId] = useState<string | null>(null)
  const [importZohoDeskOpen, setImportZohoDeskOpen] = useState(false)

  const groupManagerProduct = products?.find((p) => p.id === groupManagerProductId) || null
  const groupManagerGroups = groups?.filter((g) => g.product_id === groupManagerProductId) || []

  // Document counts per product/group
  const documentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    if (!documents) return counts

    counts.all = documents.length
    for (const doc of documents) {
      const productId = (doc as any).product_id
      const groupId = (doc as any).group_id
      if (productId) {
        counts[`product:${productId}`] = (counts[`product:${productId}`] || 0) + 1
      }
      if (groupId) {
        counts[`group:${groupId}`] = (counts[`group:${groupId}`] || 0) + 1
      }
    }
    return counts
  }, [documents])

  const handleDelete = async (id: string) => setDeleteId(id)

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteDocument.mutateAsync(deleteId)
      toast.success('Documento excluído!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir')
    } finally {
      setDeleteId(null)
    }
  }

  const handleVote = async (id: string, helpful: boolean) => {
    try {
      await voteDocument.mutateAsync({ id, helpful })
      toast.success(helpful ? 'Marcado como útil' : 'Marcado como não útil')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao votar')
    }
  }

  const handleView = (doc: KnowledgeDoc) => {
    setPreviewDoc(doc)
    setPreviewOpen(true)
  }

  // Product CRUD handlers
  const handleSaveProduct = async (data: any) => {
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, updates: data })
        toast.success('Produto atualizado!')
      } else {
        await createProduct.mutateAsync(data)
        toast.success('Produto criado!')
      }
      setProductFormOpen(false)
      setEditingProduct(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar produto')
    }
  }

  const handleEditProduct = (product: KnowledgeProduct) => {
    setEditingProduct(product)
    setProductFormOpen(true)
    setProductManagerOpen(false)
  }

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct.mutateAsync(id)
  }

  // Group CRUD handlers
  const handleCreateGroup = async (data: { product_id: string; name: string; description?: string }) => {
    await createGroup.mutateAsync(data)
  }

  const handleUpdateGroup = async (id: string, data: { name?: string; description?: string }) => {
    await updateGroup.mutateAsync({ id, updates: data })
  }

  const handleDeleteGroup = async (id: string) => {
    await deleteGroup.mutateAsync(id)
  }

  // Debounced semantic search
  useEffect(() => {
    if (!isSemanticMode) {
      clearSemanticResults()
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (search.trim().length < 3) {
      clearSemanticResults()
      return
    }
    debounceRef.current = setTimeout(() => {
      semanticSearch(search, categoryFilter)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, isSemanticMode, categoryFilter, semanticSearch, clearSemanticResults])

  // Build displayed documents
  const semanticDocIds = semanticResults?.map(r => r.id) || []

  const filteredDocs = useMemo(() => {
    let docs = isSemanticMode && semanticResults
      ? documents?.filter(doc => semanticDocIds.includes(doc.id))
          .sort((a, b) => semanticDocIds.indexOf(a.id) - semanticDocIds.indexOf(b.id))
      : documents?.filter((doc) => {
          const matchesSearch =
            !search ||
            doc.title.toLowerCase().includes(search.toLowerCase()) ||
            doc.content.toLowerCase().includes(search.toLowerCase()) ||
            doc.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
          const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter
          const matchesType = typeFilter === 'all' || doc.content_type === typeFilter
          return matchesSearch && matchesCategory && matchesType
        })

    // Apply visibility filter
    if (visibilityFilter === 'public') {
      docs = docs?.filter((doc) => (doc as any).is_public === true)
    } else if (visibilityFilter === 'ai') {
      docs = docs?.filter((doc) => (doc as any).feeds_ai === true)
    } else if (visibilityFilter === 'both') {
      docs = docs?.filter((doc) => (doc as any).is_public === true && (doc as any).feeds_ai === true)
    }

    // Apply product/group filter
    if (selectedProductId) {
      docs = docs?.filter((doc) => (doc as any).product_id === selectedProductId)
    }
    if (selectedGroupId) {
      docs = docs?.filter((doc) => (doc as any).group_id === selectedGroupId)
    }

    return docs
  }, [documents, semanticResults, semanticDocIds, isSemanticMode, search, categoryFilter, typeFilter, visibilityFilter, selectedProductId, selectedGroupId])

  const getSimilarity = (docId: string) => {
    const result = semanticResults?.find(r => r.id === docId)
    return result ? Math.round(result.similarity * 100) : null
  }

  // Get current context label
  const getContextLabel = () => {
    if (selectedGroupId) {
      const group = groups?.find((g) => g.id === selectedGroupId)
      const product = products?.find((p) => p.id === selectedProductId)
      return `${product?.name} / ${group?.name}`
    }
    if (selectedProductId) {
      return products?.find((p) => p.id === selectedProductId)?.name || ''
    }
    return 'Base de Conhecimento'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex flex-col h-screen">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie todo o conteúdo: IA, manuais, vídeos e artigos — em um só lugar
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setImportZohoDeskOpen(true)}
                title="Importar artigos do Zoho Desk"
              >
                <Download className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <Button
                onClick={() => setUploadOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Conteúdo
              </Button>
            </div>
          </div>

          {/* Visibility filter pills */}
          <div className="flex gap-2">
            {VISIBILITY_FILTERS.map((f) => {
              const Icon = f.icon
              const isActive = visibilityFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setVisibilityFilter(f.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <HierarchySidebar
            products={products || []}
            groups={groups || []}
            documentCounts={documentCounts}
            onSelectProduct={setSelectedProductId}
            onSelectGroup={setSelectedGroupId}
            onManageProducts={() => setProductManagerOpen(true)}
            onAddProduct={() => {
              setEditingProduct(null)
              setProductFormOpen(true)
            }}
            onAddGroup={(productId) => {
              setGroupManagerProductId(productId)
              setGroupManagerOpen(true)
            }}
          />

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            <div className="page-content">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {getContextLabel()}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedProductId
                      ? 'Documentos deste produto'
                      : 'Gerencie documentos, vídeos, manuais e conteúdo para IA e clientes'}
                  </p>
                </div>
              </div>

              {/* Stats */}
              {!selectedProductId && stats && <StatsCards stats={stats} />}

              {/* Advanced Filters */}
              <AdvancedFilters
                search={search}
                onSearchChange={(v) => { setSearch(v); if (!v) clearSemanticResults() }}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
                visibilityFilter={visibilityFilter}
                onVisibilityChange={setVisibilityFilter}
                isSemanticMode={isSemanticMode}
                onSemanticModeChange={setIsSemanticMode}
                isSearching={isSearching}
                searchResultsCount={semanticResults?.length}
                stats={{
                  total: stats?.total || 0,
                  viewsToday: 0,
                  topSearches: []
                }}
              />

              {/* Document Grid */}
              {filteredDocs && filteredDocs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredDocs.map((doc) => {
                    const similarity = isSemanticMode ? getSimilarity(doc.id) : null
                    return (
                      <div key={doc.id} className="relative">
                        {similarity !== null && (
                          <Badge className="absolute -top-2 -right-2 z-10 bg-primary text-primary-foreground text-xs">
                            {similarity}% similar
                          </Badge>
                        )}
                        <DocumentCard
                          doc={doc}
                          onView={handleView}
                          onDelete={handleDelete}
                          onVote={handleVote}
                          product={products?.find((p) => p.id === (doc as any).product_id)}
                          group={groups?.find((g) => g.id === (doc as any).group_id)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {search || categoryFilter !== 'all' || typeFilter !== 'all' || visibilityFilter !== 'all'
                      ? 'Nenhum documento encontrado'
                      : selectedProductId
                      ? 'Nenhum documento neste produto'
                      : 'Base de conhecimento vazia'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {search || categoryFilter !== 'all' || typeFilter !== 'all' || visibilityFilter !== 'all'
                      ? 'Tente ajustar os filtros de busca'
                      : 'Adicione seu primeiro documento para começar'}
                  </p>
                  {!search && categoryFilter === 'all' && typeFilter === 'all' && (
                    <Button onClick={() => setUploadOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Primeiro Documento
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        products={products || []}
        groups={groups || []}
        defaultProductId={selectedProductId}
        defaultGroupId={selectedGroupId}
      />
      <DocumentPreview doc={previewDoc} open={previewOpen} onOpenChange={setPreviewOpen} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir documento"
        description="Esta acao nao pode ser desfeita. O documento sera removido permanentemente da base de conhecimento."
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        loading={deleteDocument.isPending}
      />

      <ImportZohoDeskDialog
        open={importZohoDeskOpen}
        onOpenChange={setImportZohoDeskOpen}
        onSuccess={() => {}}
      />

      {/* Product Dialogs */}
      <ProductFormDialog
        open={productFormOpen}
        onOpenChange={(open) => {
          setProductFormOpen(open)
          if (!open) setEditingProduct(null)
        }}
        product={editingProduct}
        onSave={handleSaveProduct}
        loading={createProduct.isPending || updateProduct.isPending}
      />

      <ProductManagerDialog
        open={productManagerOpen}
        onOpenChange={setProductManagerOpen}
        products={products || []}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        loading={deleteProduct.isPending}
      />

      <GroupManagerDialog
        open={groupManagerOpen}
        onOpenChange={(open) => {
          setGroupManagerOpen(open)
          if (!open) setGroupManagerProductId(null)
        }}
        product={groupManagerProduct}
        groups={groupManagerGroups}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        loading={createGroup.isPending || updateGroup.isPending || deleteGroup.isPending}
      />
    </div>
  )
}
