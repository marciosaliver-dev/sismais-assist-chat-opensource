import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface WaitResponsePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function WaitResponseProperties({ config, onUpdate }: WaitResponsePropertiesProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Timeout (minutos)</Label>
        <Input
          type="number"
          min={1}
          value={config.timeout_minutes || 10}
          onChange={(e) => onUpdate('timeout_minutes', parseInt(e.target.value) || 10)}
          className="text-xs mt-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">⏳ Aguarda resposta do cliente. Se não responder no tempo configurado, segue pela saída "Timeout".</p>
    </div>
  )
}
