import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Smartphone } from 'lucide-react'

interface WhatsAppInstance {
  id: string
  instance_name: string
  phone_number: string | null
  status: string | null
  is_active: boolean
}

interface AgentChannelsProps {
  data: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

export function AgentChannels({ data, onChange }: AgentChannelsProps) {
  const selectedInstances: string[] = data.whatsapp_instances || []

  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances-for-agent-channels'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('uazapi_instances_public')
        .select('id, instance_name, phone_number, status, is_active')
        .eq('is_active', true)
        .order('instance_name')
      return (data || []) as WhatsAppInstance[]
    },
  })

  const toggle = (instanceId: string, checked: boolean) => {
    const updated = checked
      ? [...selectedInstances, instanceId]
      : selectedInstances.filter(id => id !== instanceId)
    onChange({ whatsapp_instances: updated })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          Canais WhatsApp
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Selecione em quais instâncias WhatsApp este agente de IA está ativo.
          Instâncias sem agente vinculado direcionam para fila humana.
        </p>
      </div>

      {instances.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma instância WhatsApp configurada
        </p>
      ) : (
        <div className="space-y-2">
          {instances.map(inst => {
            const isConnected = inst.status === 'connected'
            const isSelected = selectedInstances.includes(inst.id)
            return (
              <label
                key={inst.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(v) => toggle(inst.id, !!v)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inst.instance_name}</p>
                  {inst.phone_number && (
                    <p className="text-xs text-muted-foreground">{inst.phone_number}</p>
                  )}
                </div>
                <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs gap-1">
                  {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
