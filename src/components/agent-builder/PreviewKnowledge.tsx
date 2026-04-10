import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { BookOpen } from 'lucide-react'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface Product {
  id: string
  name: string
  slug: string
}

interface PreviewKnowledgeProps {
  config: AgentConfig
  availableProducts: Product[]
  onChange: (updates: Partial<AgentConfig>) => void
}

export default function PreviewKnowledge({ config, availableProducts, onChange }: PreviewKnowledgeProps) {
  const selectedProducts = config.knowledge_base_filter?.products || []
  const categories = config.knowledge_base_filter?.categories || []

  const toggleProduct = (productId: string) => {
    const current = selectedProducts
    const updated = current.includes(productId)
      ? current.filter(id => id !== productId)
      : [...current, productId]
    onChange({ knowledge_base_filter: { ...config.knowledge_base_filter, products: updated } })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="rag-toggle" className="text-sm font-medium cursor-pointer">
            Base de Conhecimento (RAG)
          </Label>
        </div>
        <Switch
          id="rag-toggle"
          checked={config.rag_enabled}
          onCheckedChange={(v) => onChange({ rag_enabled: v })}
          className="data-[state=checked]:bg-[#45E5E5]"
        />
      </div>

      {config.rag_enabled && (
        <>
          {availableProducts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Produtos</p>
              <div className="flex flex-wrap gap-2">
                {availableProducts.map(product => {
                  const isSelected = selectedProducts.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-[#E8F9F9] border-[#45E5E5] text-[#10293F]'
                          : 'bg-muted border-border text-muted-foreground hover:border-[#45E5E5]/50'
                      }`}
                    >
                      {product.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categorias filtradas</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-muted-foreground">Top-K resultados</p>
              <p className="font-semibold text-foreground text-base mt-0.5">{config.rag_top_k}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-muted-foreground">Similaridade mínima</p>
              <p className="font-semibold text-foreground text-base mt-0.5">{(config.rag_similarity_threshold * 100).toFixed(0)}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
