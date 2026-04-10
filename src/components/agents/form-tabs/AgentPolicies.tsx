import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentPolicies({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-foreground">Horário de Atendimento</Label>
        <Input
          value={data.supportHours || ''}
          onChange={(e) => onChange({ supportHours: e.target.value })}
          placeholder="Ex: Segunda a Sexta, 08:00 às 18:00"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">SLA de Atendimento</Label>
        <Input
          value={data.slaResponse || ''}
          onChange={(e) => onChange({ slaResponse: e.target.value })}
          placeholder="Ex: Primeira resposta em até 2 horas"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Política de Garantia</Label>
          <AIFieldGenerator
            fieldType="warranty_policy"
            value={data.warrantyPolicy || ''}
            onChange={(v) => onChange({ warrantyPolicy: v })}
          />
        </div>
        <Textarea
          className="min-h-[80px]"
          value={data.warrantyPolicy || ''}
          onChange={(e) => onChange({ warrantyPolicy: e.target.value })}
          placeholder="Ex: Garantia de 30 dias..."
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Política de Reembolso</Label>
          <AIFieldGenerator
            fieldType="refund_policy"
            value={data.refundPolicy || ''}
            onChange={(v) => onChange({ refundPolicy: v })}
          />
        </div>
        <Textarea
          className="min-h-[80px]"
          value={data.refundPolicy || ''}
          onChange={(e) => onChange({ refundPolicy: e.target.value })}
          placeholder="Ex: Reembolso proporcional nos primeiros 7 dias..."
        />
      </div>
    </div>
  )
}
