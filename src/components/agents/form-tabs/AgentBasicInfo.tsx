import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { TablesInsert } from '@/integrations/supabase/types'
import { coreSpecialties } from '@/components/agents/agent-specialties'
import { AIFieldGenerator } from '@/components/ai/AIFieldGenerator'

type AgentInsert = TablesInsert<'ai_agents'>

interface Props {
  data: Partial<AgentInsert>
  onChange: (updates: Partial<AgentInsert>) => void
  supportConfig?: Record<string, any>
  onSupportConfigChange?: (updates: Record<string, any>) => void
}

export function AgentBasicInfo({ data, onChange, supportConfig, onSupportConfigChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-foreground font-medium">Agente Ativo</Label>
          <p className="text-xs text-muted-foreground">
            Quando desativado, o agente não será acionado pelo orquestrador
          </p>
        </div>
        <Switch
          checked={data.is_active !== false}
          onCheckedChange={(checked) => onChange({ is_active: checked })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Nome do Agente *</Label>
          <Input
            value={data.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex: Agente Financeiro"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Especialidade *</Label>
          <Select value={data.specialty || 'support'} onValueChange={(v) => onChange({ specialty: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {coreSpecialties.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.emoji} {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {coreSpecialties.find(s => s.value === data.specialty)?.description || ''}
          </p>
        </div>
      </div>

      {data.specialty === 'group_support' && (
        <div className="space-y-2">
          <Label className="text-foreground">Modo do Grupo</Label>
          <Select
            value={supportConfig?.group_mode || 'active'}
            onValueChange={(v) => onSupportConfigChange?.({ group_mode: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">🔊 Modo Ativo — responde a todas as mensagens</SelectItem>
              <SelectItem value="silent">🔇 Modo Silencioso — só responde quando mencionado ou em reply direto</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            No modo silencioso, o agente só responde quando o nome dele é mencionado ou quando alguém responde diretamente a uma mensagem dele.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-foreground">Canal de Atuação *</Label>
        <Select value={(data as any).channel_type || 'whatsapp'} onValueChange={(v) => onChange({ channel_type: v } as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">📱 WhatsApp (responde ao cliente)</SelectItem>
            <SelectItem value="internal">🤝 Interno (copiloto do atendente)</SelectItem>
            <SelectItem value="omnichannel">🌐 Omnichannel (todos os canais)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
              <Label className="text-foreground">Descricao *</Label>
              <AIFieldGenerator
                fieldType="description"
                value={data.description || ''}
                onChange={(v) => onChange({ description: v })}
                context={{ agent_specialty: data.specialty, agent_name: data.name }}
              />
            </div>
        <Textarea
          value={data.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Ex: Resolve problemas tecnicos do sistema, como erros de login, lentidao e falhas de integracao..."
          rows={4}
          className="border-primary/40 focus:border-primary"
        />
        <p className="text-xs text-primary/80">
          Esta descricao e usada pela IA para decidir quando acionar este agente. Seja especifico sobre o que ele faz.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Cor do Agente</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={data.color || '#2563EB'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={data.color || '#2563EB'}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="#2563EB"
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Prioridade (0-100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={data.priority ?? 0}
            onChange={(e) => onChange({ priority: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">Maior = avaliado primeiro pelo orquestrador</p>
        </div>
      </div>
    </div>
  )
}
