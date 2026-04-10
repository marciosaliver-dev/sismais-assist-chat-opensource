import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'
import type { KnowledgeGroup } from '@/hooks/useKnowledgeGroups'

interface ProductSidebarProps {
  products: KnowledgeProduct[]
  groups: KnowledgeGroup[]
  selectedProductId: string | null
  selectedGroupId: string | null
  documentCounts: Record<string, number>
  onSelectProduct: (productId: string | null) => void
  onSelectGroup: (groupId: string | null) => void
  onManageProducts: () => void
  onManageGroups: (productId: string) => void
  onAddProduct: () => void
}

export function ProductSidebar({
  products,
  groups,
  selectedProductId,
  selectedGroupId,
  documentCounts,
  onSelectProduct,
  onSelectGroup,
  onManageProducts,
  onManageGroups,
  onAddProduct,
}: ProductSidebarProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set(selectedProductId ? [selectedProductId] : [])
  )

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const handleProductClick = (productId: string) => {
    if (selectedProductId === productId && !selectedGroupId) {
      onSelectProduct(null)
    } else {
      onSelectProduct(productId)
      onSelectGroup(null)
    }
    if (!expandedProducts.has(productId)) {
      toggleExpand(productId)
    }
  }

  const handleGroupClick = (groupId: string, productId: string) => {
    if (selectedGroupId === groupId) {
      onSelectGroup(null)
    } else {
      onSelectProduct(productId)
      onSelectGroup(groupId)
    }
  }

  const getProductGroups = (productId: string) =>
    groups.filter((g) => g.product_id === productId)

  return (
    <div className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Produtos</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onManageProducts}
            title="Gerenciar produtos"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAddProduct}
            title="Novo produto"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* All documents */}
      <div className="p-1">
        <button
          onClick={() => {
            onSelectProduct(null)
            onSelectGroup(null)
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            !selectedProductId
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          <Package className="w-4 h-4" />
          <span>Todos os Documentos</span>
          <Badge variant="secondary" className="ml-auto text-xs h-5">
            {documentCounts['all'] || 0}
          </Badge>
        </button>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {products.map((product) => {
          const productGroups = getProductGroups(product.id)
          const isExpanded = expandedProducts.has(product.id)
          const isSelected = selectedProductId === product.id && !selectedGroupId
          const count = documentCounts[`product:${product.id}`] || 0

          return (
            <div key={product.id}>
              <div className="flex items-center">
                <button
                  onClick={() => toggleExpand(product.id)}
                  className="p-1 hover:bg-muted/50 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleProductClick(product.id)}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted/50'
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: product.color || '#6366f1' }}
                  />
                  <span className="truncate">{product.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs h-5 shrink-0">
                    {count}
                  </Badge>
                </button>
              </div>

              {/* Groups */}
              {isExpanded && (
                <div className="ml-6 space-y-0.5 mt-0.5">
                  {productGroups.map((group) => {
                    const groupCount = documentCounts[`group:${group.id}`] || 0
                    const isGroupSelected = selectedGroupId === group.id

                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupClick(group.id, product.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
                          isGroupSelected
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{group.name}</span>
                        <Badge variant="secondary" className="ml-auto text-xs h-5 shrink-0">
                          {groupCount}
                        </Badge>
                      </button>
                    )
                  })}

                  <button
                    onClick={() => onManageGroups(product.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Gerenciar Grupos</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {products.length === 0 && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Nenhum produto cadastrado</p>
          <Button variant="outline" size="sm" onClick={onAddProduct}>
            <Plus className="w-3 h-3 mr-1" />
            Criar Produto
          </Button>
        </div>
      )}
    </div>
  )
}
