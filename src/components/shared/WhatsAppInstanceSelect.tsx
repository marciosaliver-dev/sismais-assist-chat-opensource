import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WhatsAppInstance {
  id: string
  instance_name: string
  phone_number: string | null
  status: string | null
  is_active: boolean
}

interface WhatsAppInstanceSelectProps {
  value: string
  onChange: (value: string) => void
  showSameChannel?: boolean
  required?: boolean
  label?: string
  className?: string
}

export function WhatsAppInstanceSelect({
  value,
  onChange,
  showSameChannel = false,
  required = false,
  label = 'Canal de Envio',
  className,
}: WhatsAppInstanceSelectProps) {
  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances-for-select'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('uazapi_instances_public')
        .select('id, instance_name, phone_number, status, is_active')
        .eq('is_active', true)
        .order('instance_name')
      return (data || []) as WhatsAppInstance[]
    },
  })

  return (
    <div className={className}>
      <Label className="text-xs flex items-center gap-1.5">
        <Smartphone className="w-3 h-3" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="text-xs mt-1">
          <SelectValue placeholder="Selecionar canal..." />
        </SelectTrigger>
        <SelectContent>
          {showSameChannel && (
            <SelectItem value="__same_channel__">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-primary" />
                Mesmo canal do atendimento atual
              </span>
            </SelectItem>
          )}
          {instances.map((inst) => {
            const isConnected = inst.status === 'connected'
            return (
              <SelectItem
                key={inst.id}
                value={inst.id}
                disabled={!isConnected}
              >
                <span className={cn('flex items-center gap-1.5', !isConnected && 'opacity-50')}>
                  {isConnected ? (
                    <Wifi className="w-3 h-3 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  )}
                  {inst.instance_name}
                  {inst.phone_number && (
                    <span className="text-muted-foreground">({inst.phone_number})</span>
                  )}
                  {!isConnected && (
                    <span className="text-xs text-amber-500">desconectado</span>
                  )}
                </span>
              </SelectItem>
            )
          })}
          {instances.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Nenhuma instância WhatsApp configurada
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
