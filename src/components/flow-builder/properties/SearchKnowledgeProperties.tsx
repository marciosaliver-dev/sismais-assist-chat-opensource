import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface SearchKnowledgePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function SearchKnowledgeProperties({ config, onUpdate }: SearchKnowledgePropertiesProps) {
  return (
    <>
      <Label className="text-xs">Query de Busca</Label>
      <Textarea
        value={config.query || ''}
        onChange={(e) => onUpdate('query', e.target.value)}
        placeholder="Use {message_content} para busca dinâmica"
        rows={2}
        className="text-xs"
      />
      <Label className="text-xs mt-2">Top K</Label>
      <Input
        type="number"
        value={config.top_k || 5}
        onChange={(e) => onUpdate('top_k', parseInt(e.target.value))}
        className="text-xs"
      />
      <Label className="text-xs mt-2">Categoria (opcional)</Label>
      <Input
        value={config.category || ''}
        onChange={(e) => onUpdate('category', e.target.value)}
        placeholder="Filtrar por categoria"
        className="text-xs"
      />
      <p className="text-xs text-muted-foreground mt-1">Resultado ficará em {'{knowledge_results}'}</p>
    </>
  )
}
