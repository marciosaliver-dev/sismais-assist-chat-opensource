import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

interface SwitchPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
}

export function SwitchProperties({ config, onUpdate }: SwitchPropertiesProps) {
  const cases: Array<{ value: string; label: string }> = config.cases || []

  return (
    <>
      <Label className="text-xs">Campo para Avaliar</Label>
      <Select value={config.field || ''} onValueChange={(v) => onUpdate('field', v)}>
        <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="intent">Intenção</SelectItem>
          <SelectItem value="sentiment">Sentimento</SelectItem>
          <SelectItem value="urgency">Urgência</SelectItem>
          <SelectItem value="priority">Prioridade</SelectItem>
          <SelectItem value="handler_type">Tipo de Atendente</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between mt-3">
        <Label className="text-xs">Casos</Label>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs"
          onClick={() => {
            onUpdate('cases', [...cases, { value: `case_${cases.length + 1}`, label: `Caso ${cases.length + 1}` }])
          }}
        >
          <Plus className="w-3 h-3 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2 mt-2">
        {cases.map((c, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <Input
              value={c.value}
              onChange={(e) => {
                const newCases = [...cases]
                newCases[idx] = { ...newCases[idx], value: e.target.value, label: e.target.value }
                onUpdate('cases', newCases)
              }}
              className="text-xs flex-1"
              placeholder="Valor"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => onUpdate('cases', cases.filter((_, i) => i !== idx))}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">Cada caso cria uma saída no node. Há sempre um "Padrão" automático.</p>
    </>
  )
}
