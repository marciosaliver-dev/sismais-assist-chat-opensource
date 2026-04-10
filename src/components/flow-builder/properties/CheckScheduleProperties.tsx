import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

interface CheckSchedulePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function CheckScheduleProperties({ config, onUpdate }: CheckSchedulePropertiesProps) {
  const days = config.days || []

  const toggleDay = (day: string) => {
    const newDays = days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day]
    onUpdate('days', newDays)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Horário Início</Label>
        <Input
          type="time"
          value={config.start_time || '08:00'}
          onChange={(e) => onUpdate('start_time', e.target.value)}
          className="text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Horário Fim</Label>
        <Input
          type="time"
          value={config.end_time || '18:00'}
          onChange={(e) => onUpdate('end_time', e.target.value)}
          className="text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs mb-2 block">Dias da Semana</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <label key={day} className="flex items-center gap-1 text-xs">
              <Checkbox checked={days.includes(day)} onCheckedChange={() => toggleDay(day)} />
              {day}
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">🕐 Verifica se o horário atual está dentro do intervalo configurado</p>
    </div>
  )
}
