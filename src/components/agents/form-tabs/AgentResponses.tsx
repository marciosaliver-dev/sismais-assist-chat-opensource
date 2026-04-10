import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

const responseFields = [
  { key: 'outOfHours', label: 'Fora do Horário' },
  { key: 'waitingCustomer', label: 'Aguardando Cliente' },
  { key: 'resolved', label: 'Problema Resolvido' },
  { key: 'unresolved', label: 'Não Conseguiu Resolver' },
  { key: 'needMoreInfo', label: 'Precisa de Mais Informações' },
  { key: 'thankYou', label: 'Agradecimento Final' },
]

export function AgentResponses({ data, onChange }: Props) {
  const responses = data.standardResponses || {}

  const updateResponse = (key: string, value: string) => {
    onChange({
      standardResponses: { ...responses, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {responseFields.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground">{label}</Label>
            <AIFieldGenerator
              fieldType="standard_response"
              value={responses[key] || ''}
              onChange={(v) => updateResponse(key, v)}
              context={{ agent_specialty: undefined }}
            />
          </div>
          <Textarea
            className="min-h-[80px]"
            value={responses[key] || ''}
            onChange={(e) => updateResponse(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}
