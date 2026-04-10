import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UpdateFieldPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function UpdateFieldProperties({ config, onUpdate }: UpdateFieldPropertiesProps) {
  return (
    <>
      <Label className="text-xs">Entidade</Label>
      <Select value={config.entity || 'conversation'} onValueChange={(v) => onUpdate('entity', v)}>
        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="conversation">Conversa</SelectItem>
          <SelectItem value="contact">Contato</SelectItem>
        </SelectContent>
      </Select>
      <Label className="text-xs mt-2">Campo</Label>
      <Input
        value={config.field || ''}
        onChange={(e) => onUpdate('field', e.target.value)}
        placeholder="ex: priority, status"
        className="text-xs"
      />
      <Label className="text-xs mt-2">Valor</Label>
      <Input
        value={config.value || ''}
        onChange={(e) => onUpdate('value', e.target.value)}
        placeholder="Novo valor"
        className="text-xs"
      />
    </>
  )
}
