import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AssignAIPropertiesProps {
  config: Record<string, any>
  onBatchUpdate: (updates: Record<string, any>) => void
}

export function AssignAIProperties({ config, onBatchUpdate }: AssignAIPropertiesProps) {
  const { data: agents } = useQuery({
    queryKey: ['ai-agents-select'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_agents').select('id, name, specialty').eq('is_active', true)
      return data || []
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Agente IA</Label>
        <Select
          value={config.agent_id || ''}
          onValueChange={(v) => {
            const agent = agents?.find(a => a.id === v)
            onBatchUpdate({ agent_id: v, agent_name: agent?.name })
          }}
        >
          <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
          <SelectContent>
            {agents?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} {agent.specialty && `(${agent.specialty})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        🤖 Conversa será transferida para o agente IA selecionado
      </p>
    </div>
  )
}
