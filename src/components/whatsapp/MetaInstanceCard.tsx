import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Pencil, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MetaInstanceCardProps {
  instance: {
    id: string
    display_name: string
    phone_number: string
    is_active: boolean
    status: string
    config: Record<string, unknown>
    messages_sent_count: number
    messages_received_count: number
    last_message_at: string | null
  }
  onEdit: (instance: any) => void
  onTestConnection: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
  isTestingConnection: boolean
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  connected: { label: 'Conectado', color: 'border-green-300 bg-green-50 text-green-700', icon: CheckCircle },
  disconnected: { label: 'Desconectado', color: 'border-red-300 bg-red-50 text-red-700', icon: XCircle },
  error: { label: 'Erro', color: 'border-yellow-400 bg-yellow-50 text-yellow-800', icon: AlertTriangle },
  pending_setup: { label: 'Pendente', color: 'border-slate-300 bg-slate-50 text-slate-600', icon: AlertTriangle },
}

function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado!') }}
        className="flex items-center gap-1 font-mono text-foreground hover:text-primary transition-colors"
      >
        {value}
        <Copy className="h-3 w-3 opacity-50" />
      </button>
    </div>
  )
}

export function MetaInstanceCard({
  instance,
  onEdit,
  onTestConnection,
  onToggleActive,
  isTestingConnection,
}: MetaInstanceCardProps) {
  const config = instance.config || {}
  const status = statusConfig[instance.status] || statusConfig.pending_setup
  const StatusIcon = status.icon

  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{instance.display_name}</h3>
            <p className="text-xs text-muted-foreground">{instance.phone_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`gap-1 text-xs ${status.color}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  checked={instance.is_active}
                  onCheckedChange={(checked) => onToggleActive(instance.id, checked)}
                />
              </TooltipTrigger>
              <TooltipContent>{instance.is_active ? 'Desativar' : 'Ativar'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="space-y-1 border-t border-border pt-2">
          <CopyableField label="WABA ID" value={String(config.waba_id || '-')} />
          <CopyableField label="Phone Number ID" value={String(config.phone_number_id || '-')} />
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-2">
          <span>Enviadas: <strong className="text-foreground">{instance.messages_sent_count}</strong></span>
          <span>Recebidas: <strong className="text-foreground">{instance.messages_received_count}</strong></span>
          {instance.last_message_at && (
            <span>
              Última: {formatDistanceToNow(new Date(instance.last_message_at), { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>

        <div className="flex gap-2 border-t border-border pt-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(instance)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTestConnection(instance.id)}
            disabled={isTestingConnection}
            className="gap-1"
          >
            {isTestingConnection ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Testar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
