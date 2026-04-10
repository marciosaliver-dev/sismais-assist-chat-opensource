import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { usePromptMethods } from '@/hooks/usePromptMethods'

interface Props {
  selectedMethods: string[]
  onMethodsChange: (methods: string[]) => void
  specialty?: string
}

export function MethodSelector({ selectedMethods, onMethodsChange, specialty }: Props) {
  const { methods, isLoading } = usePromptMethods()

  if (isLoading || methods.length === 0) return null

  const recommended = methods.find(m =>
    specialty && m.recommended_specialties.includes(specialty)
  )

  const primary = selectedMethods[0] || recommended?.name || ''
  const complementary = selectedMethods.slice(1)

  const handlePrimaryChange = (value: string) => {
    onMethodsChange([value, ...complementary])
  }

  const handleComplementaryToggle = (name: string, checked: boolean) => {
    if (checked) {
      onMethodsChange([primary, ...complementary, name])
    } else {
      onMethodsChange([primary, ...complementary.filter(m => m !== name)])
    }
  }

  const complementaryOptions = methods.filter(m => m.name !== primary)

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Método Principal</Label>
        <Select value={primary} onValueChange={handlePrimaryChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {methods.map(m => (
              <SelectItem key={m.name} value={m.name}>
                {m.label}
                {specialty && m.recommended_specialties.includes(specialty) && ' ★'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {complementaryOptions.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">Combinar com:</Label>
          <div className="space-y-2 mt-1.5">
            {complementaryOptions.map(m => (
              <div key={m.name} className="flex items-center gap-2">
                <Checkbox
                  id={`method-${m.name}`}
                  checked={complementary.includes(m.name)}
                  onCheckedChange={(checked) => handleComplementaryToggle(m.name, !!checked)}
                />
                <label htmlFor={`method-${m.name}`} className="text-xs text-foreground cursor-pointer">
                  {m.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
