import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface SetVariablePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function SetVariableProperties({ config, onUpdate }: SetVariablePropertiesProps) {
  const variableName = config.variable_name || ''

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Nome da Variável</Label>
        <Input
          value={variableName}
          onChange={(e) => onUpdate('variable_name', e.target.value)}
          placeholder="minha_variavel"
          className="text-xs font-mono mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Valor</Label>
        <Textarea
          value={config.value || ''}
          onChange={(e) => onUpdate('value', e.target.value)}
          placeholder="Valor da variável..."
          className="text-xs mt-1"
          rows={2}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use {'{customer_name}'}, {'{message_content}'} ou valores fixos
        </p>
      </div>

      {variableName && (
        <div className="p-2.5 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Referência:</p>
          <code className="text-xs text-primary font-mono">
            {`{${variableName}}`}
          </code>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        📝 Use em mensagens posteriores com {`{${variableName || 'variavel'}}`}
      </p>
    </div>
  )
}
