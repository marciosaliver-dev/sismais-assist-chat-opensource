import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Settings, Trash2, Play, BarChart3, FlaskConical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '@/integrations/supabase/types'

type Automation = Tables<'ai_automations'>

interface AutomationCardProps {
  automation: Automation
  onEdit: (automation: Automation) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onViewLogs: (id: string) => void
}

const TRIGGER_LABELS: Record<string, string> = {
  message_received: '📩 Mensagem Recebida',
  ticket_created: '🎫 Ticket Criado',
  ticket_updated: '🔄 Ticket Atualizado',
  ai_response_sent: '🤖 IA Respondeu',
  human_takeover: '👤 Humano Assumiu',
  csat_received: '⭐ CSAT Recebido',
  scheduled: '⏰ Agendado',
}

export function AutomationCard({
  automation, onEdit, onDelete, onToggle, onViewLogs
}: AutomationCardProps) {
  const navigate = useNavigate()
  const actions = (automation.actions as any[]) || []
  const conditions = (automation.trigger_conditions as any[]) || []

  return (
    <Card className={`transition-all ${!automation.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{automation.name}</h3>
              <Switch
                checked={automation.is_active ?? false}
                onCheckedChange={(checked) => onToggle(automation.id, checked)}
              />
            </div>

            {automation.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{automation.description}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}</Badge>
              {conditions.length > 0 && (
                <Badge variant="secondary">{conditions.length} condição(ões)</Badge>
              )}
              <Badge variant="secondary">{actions.length} ação(ões)</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Executada {automation.execution_count ?? 0} vezes
            {automation.last_executed_at && (
              <> · Última: {formatDistanceToNow(new Date(automation.last_executed_at), { addSuffix: true, locale: ptBR })}</>
            )}
          </p>

          <div className="flex items-center gap-1">
            <Button onClick={() => navigate(`/automations/playground/${automation.id}`)} size="icon" variant="ghost" title="Testar">
              <FlaskConical className="w-4 h-4" />
            </Button>
            <Button onClick={() => onViewLogs(automation.id)} size="icon" variant="ghost" title="Ver Logs">
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button onClick={() => onEdit(automation)} size="icon" variant="ghost" title="Editar">
              <Settings className="w-4 h-4" />
            </Button>
            <Button onClick={() => onDelete(automation.id)} size="icon" variant="ghost" className="text-destructive" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
