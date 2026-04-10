import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props { config: Record<string, any>; onUpdate: (key: string, value: any) => void }

export function SendInternalMessageProperties({ config, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nota Interna</Label>
        <Textarea className="text-xs mt-1" placeholder="Mensagem visível apenas para agentes..."
          value={config.message || ''} onChange={e => onUpdate('message', e.target.value)} rows={3} />
      </div>
      <p className="text-xs text-muted-foreground">
        Variáveis: {'{nome_cliente}'}, {'{nome_agente}'}, {'{etapa_atual}'}
      </p>
    </div>
  )
}
