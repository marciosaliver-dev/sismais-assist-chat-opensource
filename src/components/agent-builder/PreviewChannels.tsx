import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MessageCircle } from 'lucide-react'
import type { AgentConfig } from '@/hooks/useAgentBuilder'

interface Instance {
  id: string
  instance_name: string
  phone_number?: string
  status?: string
}

interface PreviewChannelsProps {
  config: AgentConfig
  availableInstances: Instance[]
  onToggle: (instanceId: string) => void
}

export default function PreviewChannels({ config, availableInstances, onToggle }: PreviewChannelsProps) {
  if (availableInstances.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center italic">Nenhuma instância WhatsApp configurada.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2.5">
      {availableInstances.map(instance => {
        const isChecked = config.whatsapp_instances.includes(instance.id)
        const isConnected = instance.status === 'connected' || instance.status === 'open'
        return (
          <label
            key={instance.id}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggle(instance.id)}
              id={`instance-${instance.id}`}
              className="data-[state=checked]:bg-[#45E5E5] data-[state=checked]:border-[#45E5E5]"
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MessageCircle className="w-4 h-4 text-[#25D366] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{instance.instance_name}</p>
                {instance.phone_number && (
                  <p className="text-xs text-muted-foreground">{instance.phone_number}</p>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={isConnected
                ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                : 'bg-gray-50 text-gray-500 border-gray-200 text-xs'
              }
            >
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </label>
        )
      })}
    </div>
  )
}
