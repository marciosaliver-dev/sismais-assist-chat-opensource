import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'
import type { KnowledgeGroup } from '@/hooks/useKnowledgeGroups'
import {
  Package,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  Layers,
  FileText,
  Link,
  Video,
  FileQuestion,
  ArrowRight,
} from 'lucide-react'

interface HierarchySidebarProps {
  products: KnowledgeProduct[]
  groups: KnowledgeGroup[]
  documentCounts: Record<string, number>
  onSelectProduct: (productId: string | null) => void
  onSelectGroup: (groupId: string | null) => void
  onManageProducts: () => void
  onAddProduct: () => void
  onAddGroup: (productId: string) => void
}

export function HierarchySidebar({
  products,
  groups,
  documentCounts,
  onSelectProduct,
  onSelectGroup,
  onManageProducts,
  onManageGroups,
  onAddProduct,
  onAddGroup,
}: HierarchySidebarProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleProductExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const getProductGroups = (productId: string) => {
    return groups.filter(g => g.product_id === productId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }

  const getGroupIcon = (groupName: string) => {
    const name = groupName.toLowerCase()
    if (name.includes('faq') || name.includes('pergunt')) return FileQuestion
    if (name.includes('tutorial') || name.includes('como')) return FileText
    if (name.includes('video')) return Video
    if (name.includes('link') || name.includes('externo')) return Link
    return FolderOpen
  }

  return (
    <div className="w-72 shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-[#10293F]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#45E5E5]" />
          <span className="text-sm font-semibold text-white">Navegação</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
            onClick={onManageProducts}
            title="Gerenciar estrutura"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* All documents - Quick access */}
      <div className="p-2 border-b border-border/50">
        <button
          onClick={() => {
            onSelectProduct(null)
            onSelectGroup(null)
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all',
            'hover:bg-muted/50',
          )}
        >
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Todos os Documentos</span>
          <Badge variant="secondary" className="ml-auto text-xs h-5 bg-[#E8F9F9] text-[#10293F]">
            {documentCounts['all'] || 0}
          </Badge>
        </button>
      </div>

      {/* Quick filters */}
      <div className="p-2 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-1">
          Acesso Rápido
        </div>
        <div className="space-y-0.5 mt-1">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <FileQuestion className="w-4 h-4 text-[#FFB800]" />
            <span>FAQs</span>
            <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Video className="w-4 h-4 text-[#DC2626]" />
            <span>Vídeos</span>
            <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <span>Tutoriais</span>
            <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>

      {/* Products and Groups Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
          Estrutura
        </div>
        
        <div className="space-y-0.5">
          {products.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((product) => {
            const productGroups = getProductGroups(product.id)
            const isProductExpanded = expandedProducts.has(product.id)
            const productCount = documentCounts[`product:${product.id}`] || 0

            return (
              <div key={product.id} className="group">
                {/* Product Row */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleProductExpand(product.id)}
                    className="p-1 hover:bg-muted/50 rounded text-muted-foreground"
                  >
                    {isProductExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onSelectProduct(product.id)}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors',
                      'hover:bg-muted/50'
                    )}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: product.color || '#6366f1' }}
                    />
                    <span className="truncate font-medium text-foreground">{product.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-5 shrink-0">
                      {productCount}
                    </Badge>
                  </button>
                </div>

                {/* Groups */}
                {isProductExpanded && (
                  <div className="ml-4 space-y-0.5 mt-0.5 border-l-2 border-border/30 pl-2">
                    {productGroups.map((group) => {
                      const groupCount = documentCounts[`group:${group.id}`] || 0
                      const GroupIcon = getGroupIcon(group.name)

                      return (
                        <div key={group.id}>
                          <button
                            onClick={() => onSelectGroup(group.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
                              'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <GroupIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{group.name}</span>
                            <Badge variant="outline" className="ml-auto text-xs h-5 shrink-0">
                              {groupCount}
                            </Badge>
                          </button>
                        </div>
                      )
                    })}

                    {/* Add Group Button */}
                    <button
                      onClick={() => onAddGroup(product.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar submenu</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Product */}
        <button
          onClick={onAddProduct}
          className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors border border-dashed border-border"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto / Menu</span>
        </button>
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
