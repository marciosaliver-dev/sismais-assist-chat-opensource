import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Props { config: Record<string, any>; onUpdate: (key: string, value: any) => void }

export function RemoveTagProperties({ config, onUpdate }: Props) {
  return (
    <div>
      <Label className="text-xs">Tag a Remover</Label>
      <Input className="text-xs mt-1" placeholder="Nome da tag..." value={config.tag || ''}
        onChange={e => onUpdate('tag', e.target.value)} />
    </div>
  )
}
