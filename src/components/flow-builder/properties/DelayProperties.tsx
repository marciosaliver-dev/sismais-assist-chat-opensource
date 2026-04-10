import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DelayPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function DelayProperties({ config, onUpdate }: DelayPropertiesProps) {
  const value = config.duration || 5
  const unit = config.unit || 'minutes'

  const getDurationInSeconds = () => {
    const multipliers: Record<string, number> = {
      seconds: 1,
      minutes: 60,
      hours: 3600,
      days: 86400
    }
    return value * (multipliers[unit] || 60)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Tempo de Espera</Label>
        <div className="flex gap-2 mt-1.5">
          <Input
            type="number"
            min={1}
            value={value}
            onChange={(e) => onUpdate('duration', parseInt(e.target.value) || 1)}
            className="text-xs w-24"
          />
          <Select value={unit} onValueChange={(v) => onUpdate('unit', v)}>
            <SelectTrigger className="text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Segundos</SelectItem>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-muted/50 text-center">
        <p className="text-xs text-muted-foreground mb-1">Aguardar</p>
        <p className="text-lg font-bold text-foreground">
          {value} {unit === 'seconds' ? 'seg' : unit === 'minutes' ? 'min' : unit === 'hours' ? 'h' : 'dias'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          = {getDurationInSeconds().toLocaleString()} segundos
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        ⏰ A execução será pausada pelo tempo configurado
      </p>
    </div>
  )
}
