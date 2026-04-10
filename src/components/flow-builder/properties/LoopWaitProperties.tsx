import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface LoopWaitPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function LoopWaitProperties({ config, onUpdate }: LoopWaitPropertiesProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Intervalo (minutos)</Label>
        <Input
          type="number"
          min={1}
          value={config.interval_minutes || 5}
          onChange={(e) => onUpdate('interval_minutes', parseInt(e.target.value) || 5)}
          className="text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Máximo de repetições</Label>
        <Input
          type="number"
          min={1}
          value={config.max_iterations || 10}
          onChange={(e) => onUpdate('max_iterations', parseInt(e.target.value) || 10)}
          className="text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Condição de saída</Label>
        <Textarea
          value={config.exit_condition || ''}
          onChange={(e) => onUpdate('exit_condition', e.target.value)}
          placeholder="Descrição da condição..."
          className="text-xs mt-1"
          rows={2}
        />
      </div>
      <p className="text-xs text-muted-foreground">🔄 Repete a cada X minutos até a condição ser satisfeita ou atingir o máximo de repetições</p>
    </div>
  )
}
