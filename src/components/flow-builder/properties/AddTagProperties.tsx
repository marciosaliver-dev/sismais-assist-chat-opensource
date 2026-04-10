import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'

interface AddTagPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function AddTagProperties({ config, onUpdate }: AddTagPropertiesProps) {
  const [newTag, setNewTag] = useState('')
  const tags: string[] = config.tags || (config.tag ? [config.tag] : [])

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onUpdate('tags', [...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    onUpdate('tags', tags.filter(t => t !== tag))
  }

  const addPresetTag = (tag: string) => {
    if (!tags.includes(tag)) {
      onUpdate('tags', [...tags, tag])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Adicionar Tag</Label>
        <div className="flex gap-1.5 mt-1.5">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Digite uma tag..."
            className="text-xs"
          />
          <Button onClick={addTag} size="icon" variant="outline" className="h-9 w-9 shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {['urgente', 'vip', 'suporte', 'vendas', 'financeiro'].map(tag => (
          <Badge
            key={tag}
            variant="outline"
            className="text-xs cursor-pointer hover:bg-accent"
            onClick={() => addPresetTag(tag)}
          >
            + {tag}
          </Badge>
        ))}
      </div>

      {tags.length > 0 && (
        <div>
          <Label className="text-xs">Tags Adicionadas</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        🏷️ Tags serão adicionadas à conversa para segmentação
      </p>
    </div>
  )
}
