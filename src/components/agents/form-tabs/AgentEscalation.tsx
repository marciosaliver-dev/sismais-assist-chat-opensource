import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'
import { AlertTriangle, Plus, X } from 'lucide-react'

interface Props {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentEscalation({ data, onChange }: Props) {
  const triggers: string[] = data.escalationTriggers || []

  const addTrigger = () => {
    onChange({ escalationTriggers: [...triggers, ''] })
  }

  const updateTrigger = (index: number, value: string) => {
    const updated = [...triggers]
    updated[index] = value
    onChange({ escalationTriggers: updated })
  }

  const removeTrigger = (index: number) => {
    onChange({ escalationTriggers: triggers.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Gatilhos de Escalação</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTrigger}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {triggers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <Input
                value={t}
                onChange={(e) => updateTrigger(i, e.target.value)}
                placeholder="Ex: Cliente solicita cancelamento"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTrigger(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Mensagem de Transferência</Label>
          <AIFieldGenerator
            fieldType="escalation_message"
            value={data.escalationMessage || ''}
            onChange={(v) => onChange({ escalationMessage: v })}
          />
        </div>
        <Textarea
          className="min-h-[80px]"
          value={data.escalationMessage || ''}
          onChange={(e) => onChange({ escalationMessage: e.target.value })}
          placeholder="Ex: Vou transferir você para um especialista..."
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Regras Detalhadas</Label>
          <AIFieldGenerator
            fieldType="escalation_rules"
            value={data.escalationRules || ''}
            onChange={(v) => onChange({ escalationRules: v })}
          />
        </div>
        <Textarea
          className="min-h-[100px]"
          value={data.escalationRules || ''}
          onChange={(e) => onChange({ escalationRules: e.target.value })}
          placeholder="Ex: Escalar imediatamente casos de segurança..."
        />
      </div>
    </div>
  )
}
