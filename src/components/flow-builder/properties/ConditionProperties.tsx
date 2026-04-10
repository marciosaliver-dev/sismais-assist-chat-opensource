import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ConditionPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function ConditionProperties({ config, onUpdate }: ConditionPropertiesProps) {
  const fieldOptions = [
    { value: 'sentiment', label: 'Sentimento' },
    { value: 'urgency', label: 'Urgência' },
    { value: 'message_content', label: 'Conteúdo da Mensagem' },
    { value: 'handler_type', label: 'Tipo de Atendente' },
    { value: 'customer_phone', label: 'Telefone' },
    { value: 'intent', label: 'Intenção' },
    { value: 'confidence', label: 'Confiança' },
    { value: 'messages_count', label: 'Número de Mensagens' },
    { value: 'has_tag', label: 'Possui Tag' },
  ]

  const operatorOptions = [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'contains', label: 'Contém' },
    { value: 'not_contains', label: 'Não contém' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'exists', label: 'Existe' },
    { value: 'not_exists', label: 'Não existe' },
  ]

  return (
    <>
      <Label className="text-xs">Campo</Label>
      <Select value={config.field || ''} onValueChange={(v) => onUpdate('field', v)}>
        <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {fieldOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="text-xs mt-2">Operador</Label>
      <Select value={config.operator || 'equals'} onValueChange={(v) => onUpdate('operator', v)}>
        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {operatorOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="text-xs mt-2">Valor</Label>
      <Input
        value={config.value || ''}
        onChange={(e) => onUpdate('value', e.target.value)}
        placeholder="Valor para comparar"
        className="text-xs"
      />
      <p className="text-xs text-muted-foreground mt-1">Para listas, separe por vírgula</p>

      <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border">
        <p className="text-xs font-medium text-foreground">Preview:</p>
        <p className="text-xs text-muted-foreground font-mono">
          SE {config.field || '?'} {config.operator || '='} "{config.value || '?'}"
        </p>
      </div>
    </>
  )
}
