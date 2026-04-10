import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface JumpToFlowPropertiesProps {
  config: Record<string, any>
  onBatchUpdate: (updates: Record<string, any>) => void
}

export function JumpToFlowProperties({ config, onBatchUpdate }: JumpToFlowPropertiesProps) {
  const { data: flows } = useQuery({
    queryKey: ['flows-select'],
    queryFn: async () => {
      const { data } = await supabase.from('flow_automations').select('id, name').eq('is_active', true).order('name')
      return data || []
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Fluxo de Destino</Label>
        <Select
          value={config.flow_id || ''}
          onValueChange={(v) => {
            const flow = flows?.find(f => f.id === v)
            onBatchUpdate({ flow_id: v, flow_name: flow?.name })
          }}
        >
          <SelectTrigger className="text-xs mt-1"><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
          <SelectContent>
            {flows?.map((flow) => (
              <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        ➡️ Redirecionará para outro fluxo após este ponto
      </p>
    </div>
  )
}
