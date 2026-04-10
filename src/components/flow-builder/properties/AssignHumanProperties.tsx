import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AssignHumanPropertiesProps {
  config: Record<string, any>
  onUpdate: (key: string, value: any) => void
  onBatchUpdate: (updates: Record<string, any>) => void
}

export function AssignHumanProperties({ config, onUpdate, onBatchUpdate }: AssignHumanPropertiesProps) {
  const { data: humanAgents } = useQuery({
    queryKey: ['human-agents-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('human_agents')
        .select('id, name, is_online, current_conversations_count, max_concurrent_conversations')
        .eq('is_active', true)
      return data || []
    },
  })

  return (
    <>
      <Label className="text-xs">Estratégia de Atribuição</Label>
      <RadioGroup
        value={config.strategy || 'round_robin'}
        onValueChange={(v) => onUpdate('strategy', v)}
        className="mt-2 space-y-2"
      >
        <div className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="round_robin" id="rr" className="mt-0.5" />
          <label htmlFor="rr" className="cursor-pointer">
            <p className="text-xs font-medium">Round Robin</p>
            <p className="text-xs text-muted-foreground">Distribui igualmente entre agentes</p>
          </label>
        </div>
        <div className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="least_busy" id="lb" className="mt-0.5" />
          <label htmlFor="lb" className="cursor-pointer">
            <p className="text-xs font-medium">Menos Ocupado</p>
            <p className="text-xs text-muted-foreground">Atribui para agente com menos conversas</p>
          </label>
        </div>
        <div className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
          <RadioGroupItem value="specific" id="sp" className="mt-0.5" />
          <label htmlFor="sp" className="cursor-pointer">
            <p className="text-xs font-medium">Agente Específico</p>
            <p className="text-xs text-muted-foreground">Escolher manualmente</p>
          </label>
        </div>
      </RadioGroup>

      {config.strategy === 'specific' && (
        <>
          <Label className="text-xs mt-3">Agente Humano</Label>
          <Select
            value={config.agent_id || ''}
            onValueChange={(v) => {
              const agent = humanAgents?.find(a => a.id === v)
              onBatchUpdate({ agent_id: v, agent_name: agent?.name })
            }}
          >
            <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {humanAgents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.is_online ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    {agent.name}
                    <span className="text-muted-foreground">
                      ({agent.current_conversations_count}/{agent.max_concurrent_conversations})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <Label className="text-xs mt-3">Filtro por Especialidade</Label>
      <Input
        value={config.specialty_filter || ''}
        onChange={(e) => onUpdate('specialty_filter', e.target.value)}
        placeholder="ex: vendas, suporte"
        className="text-xs"
      />

      <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground">
          💡 {config.strategy === 'specific'
            ? 'Conversa será atribuída para o agente selecionado'
            : 'Sistema escolherá o melhor agente disponível'}
        </p>
      </div>
    </>
  )
}
