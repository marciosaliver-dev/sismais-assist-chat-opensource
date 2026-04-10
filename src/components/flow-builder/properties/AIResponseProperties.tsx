import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AIResponsePropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
  onBatchUpdate: (updates: Record<string, any>) => void
}

export function AIResponseProperties({ config, onUpdate, onBatchUpdate }: AIResponsePropertiesProps) {
  const { data: agents } = useQuery({
    queryKey: ['ai-agents-select'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_agents').select('id, name, specialty').eq('is_active', true)
      return data || []
    },
  })

  return (
    <>
      <Label className="text-xs">Agente IA</Label>
      <Select
        value={config.agent_id || ''}
        onValueChange={(v) => {
          const agent = agents?.find(a => a.id === v)
          onBatchUpdate({ agent_id: v, agent_name: agent?.name })
        }}
      >
        <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
        <SelectContent>
          {agents?.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name} {agent.specialty && `(${agent.specialty})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="text-xs mt-2">Contexto Extra</Label>
      <Textarea
        value={config.context || ''}
        onChange={(e) => onUpdate('context', e.target.value)}
        placeholder="Instruções adicionais para o agente..."
        rows={3}
        className="text-xs"
      />

      <div className="flex items-center justify-between mt-3">
        <Label className="text-xs">Usar RAG</Label>
        <Switch
          checked={config.use_rag ?? true}
          onCheckedChange={(v) => onUpdate('use_rag', v)}
        />
      </div>

      <Label className="text-xs mt-3">
        Limite de Confiança: {((config.confidence_threshold || 0.7) * 100).toFixed(0)}%
      </Label>
      <Slider
        value={[config.confidence_threshold || 0.7]}
        onValueChange={(v) => onUpdate('confidence_threshold', v[0])}
        min={0.5}
        max={0.95}
        step={0.05}
        className="mt-1"
      />
      <p className="text-xs text-muted-foreground mt-1">Abaixo desse limite, escalará para humano</p>
    </>
  )
}
