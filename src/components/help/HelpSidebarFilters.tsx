import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Package, FolderOpen, FileText, Video, BookOpen, Link as LinkIcon, Image as ImageIcon } from 'lucide-react'

interface Product {
  id: string
  name: string
  color: string | null
  contentCount: number
}

interface Group {
  id: string
  name: string
  product_id: string
}

interface HelpSidebarFiltersProps {
  products: Product[]
  groups: Group[]
  selectedProductId: string | null
  selectedGroupId: string | null
  selectedType: string | null
  onSelectProduct: (id: string | null) => void
  onSelectGroup: (id: string | null) => void
  onSelectType: (type: string | null) => void
}

const CONTENT_TYPES = [
  { value: null, label: 'Todos', icon: FolderOpen },
  { value: 'text', label: 'Manuais', icon: BookOpen },
  { value: 'video', label: 'Vídeos', icon: Video },
  { value: 'link', label: 'Artigos', icon: LinkIcon },
  { value: 'image', label: 'Imagens', icon: ImageIcon },
  { value: 'pdf', label: 'PDFs', icon: FileText },
]

export function HelpSidebarFilters({
  products,
  groups,
  selectedProductId,
  selectedGroupId,
  selectedType,
  onSelectProduct,
  onSelectGroup,
  onSelectType,
}: HelpSidebarFiltersProps) {
  const filteredGroups = selectedProductId
    ? groups.filter((g) => g.product_id === selectedProductId)
    : []

  return (
    <aside className="w-64 shrink-0 space-y-6">
      {/* Products */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Produtos
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => { onSelectProduct(null); onSelectGroup(null) }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              !selectedProductId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Package className="w-4 h-4" />
            Todos os Produtos
          </button>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelectProduct(p.id); onSelectGroup(null) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                selectedProductId === p.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
              <span className="truncate">{p.name}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{p.contentCount}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Groups (when product selected) */}
      {filteredGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Grupos
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => onSelectGroup(null)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedGroupId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <FolderOpen className="w-4 h-4" />
              Todos os Grupos
            </button>
            {filteredGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => onSelectGroup(g.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedGroupId === g.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <FolderOpen className="w-4 h-4" />
                <span className="truncate">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content type */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tipo de Conteúdo
        </h3>
        <div className="space-y-1">
          {CONTENT_TYPES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.value ?? 'all'}
                onClick={() => onSelectType(t.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedType === t.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
