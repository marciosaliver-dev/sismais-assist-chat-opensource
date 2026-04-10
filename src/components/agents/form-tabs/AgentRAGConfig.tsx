import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X, Globe2 } from 'lucide-react'
import { useState } from 'react'
import { useKnowledgeProducts } from '@/hooks/useKnowledgeProducts'
import type { TablesInsert } from '@/integrations/supabase/types'
import type { Json } from '@/integrations/supabase/types'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
}

export function AgentRAGConfig({ data, onChange }: Props) {
  const [newTag, setNewTag] = useState('')
  const { products } = useKnowledgeProducts()
  const knowledgeFilter = (data.knowledge_base_filter as { categories?: string[]; tags?: string[]; products?: string[] }) || { categories: [], tags: [], products: [] }

  const addTag = () => {
    if (!newTag.trim()) return
    onChange({
      knowledge_base_filter: {
        ...knowledgeFilter,
        tags: [...(knowledgeFilter.tags || []), newTag.trim()],
      } as unknown as Json,
    })
    setNewTag('')
  }

  const removeTag = (tag: string) => {
    onChange({
      knowledge_base_filter: {
        ...knowledgeFilter,
        tags: (knowledgeFilter.tags || []).filter((t) => t !== tag),
      } as unknown as Json,
    })
  }

  const toggleCategory = (category: string) => {
    const cats = knowledgeFilter.categories || []
    const isSelected = cats.includes(category)
    onChange({
      knowledge_base_filter: {
        ...knowledgeFilter,
        categories: isSelected ? cats.filter((c) => c !== category) : [...cats, category],
      } as unknown as Json,
    })
  }

  const toggleProduct = (productId: string) => {
    const prods = knowledgeFilter.products || []
    const isSelected = prods.includes(productId)
    onChange({
      knowledge_base_filter: {
        ...knowledgeFilter,
        products: isSelected ? prods.filter((p) => p !== productId) : [...prods, productId],
      } as unknown as Json,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Habilitar RAG</p>
          <p className="text-xs text-muted-foreground">Usar base de conhecimento para responder</p>
        </div>
        <Switch checked={data.rag_enabled ?? true} onCheckedChange={(v) => onChange({ rag_enabled: v })} />
      </div>

      {data.rag_enabled !== false && (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Globe2 className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Base de Conhecimento Global</p>
              <p className="text-xs text-muted-foreground">
                Este agente herda automaticamente todos os documentos marcados como globais na base de conhecimento.
                Use os filtros abaixo para refinar quais documentos adicionais incluir.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Top K Documentos</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={data.rag_top_k ?? 5}
              onChange={(e) => onChange({ rag_top_k: parseInt(e.target.value) || 5 })}
            />
            <p className="text-xs text-muted-foreground">Quantos documentos retornar (1-10)</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-foreground">Threshold de Similaridade</Label>
              <span className="text-sm text-primary font-medium">
                {((Number(data.rag_similarity_threshold) || 0.75) * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[Number(data.rag_similarity_threshold) || 0.75]}
              min={0.5}
              max={0.95}
              step={0.05}
              onValueChange={([v]) => onChange({ rag_similarity_threshold: v })}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mais resultados</span>
              <span>Mais precisão</span>
            </div>
          </div>

          {/* Product filter */}
          {products && products.length > 0 && (
            <div className="space-y-2">
              <Label className="text-foreground">Filtrar por Produto</Label>
              <p className="text-xs text-muted-foreground">
                Se nenhum selecionado, o agente consulta automaticamente a base do produto do cliente.
                Selecione produtos para restringir a busca.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {products.map((product) => {
                  const isSelected = (knowledgeFilter.products || []).includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                        isSelected ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: product.color || '#6366f1' }}
                      />
                      {product.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Filtrar por Categoria</Label>
            <div className="grid grid-cols-4 gap-2">
              {['faq', 'tutorial', 'troubleshooting', 'policy'].map((cat) => {
                const isSelected = (knowledgeFilter.categories || []).includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`p-2.5 rounded-lg border text-sm transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Filtrar por Tags</Label>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Digite uma tag e pressione Enter"
            />
            {knowledgeFilter.tags && knowledgeFilter.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {knowledgeFilter.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
