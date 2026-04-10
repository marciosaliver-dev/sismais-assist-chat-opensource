import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CheckCustomerPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function CheckCustomerProperties({ config, onUpdate }: CheckCustomerPropertiesProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Campo a Verificar</Label>
        <Select value={config.field || ''} onValueChange={(v) => onUpdate('field', v)}>
          <SelectTrigger className="text-xs mt-1">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="has_contract" className="text-xs">Tem contrato ativo</SelectItem>
            <SelectItem value="is_vip" className="text-xs">É VIP</SelectItem>
            <SelectItem value="health_score_above" className="text-xs">Health Score acima de</SelectItem>
            <SelectItem value="has_tag" className="text-xs">Tem tag</SelectItem>
            <SelectItem value="first_contact" className="text-xs">Primeiro contato</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Valor</Label>
        <Input
          value={config.value || ''}
          onChange={(e) => onUpdate('value', e.target.value)}
          placeholder="Valor para comparar..."
          className="text-xs mt-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">👤 Verifica uma condição do cliente e direciona o fluxo</p>
    </div>
  )
}
