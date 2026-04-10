import { useAgentHealth } from '@/hooks/useAgentHealth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, MessageSquare, Users, Inbox, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AgentHealthPanel() {
  const { data: health, isLoading } = useAgentHealth(24)

  if (isLoading || !health) return null

  const isHealthy = health.responseRate >= 95
  const hasDeadLetters = health.deadLetterCount > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Saúde dos Agentes (24h)
          </CardTitle>
          <Badge variant={isHealthy ? 'default' : 'destructive'}>
            {isHealthy ? 'Saudável' : 'Atenção'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> Recebidas
            </div>
            <p className="text-2xl font-bold">{health.totalMessages}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="w-3 h-3" /> Taxa de Resposta
            </div>
            <p className={cn('text-2xl font-bold', health.responseRate < 95 && 'text-destructive')}>
              {health.responseRate.toFixed(1)}%
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" /> Escalações
            </div>
            <p className="text-2xl font-bold">{health.escalations}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Inbox className="w-3 h-3" /> Fila (dead letter)
            </div>
            <p className={cn('text-2xl font-bold', hasDeadLetters && 'text-yellow-600')}>
              {health.deadLetterCount}
            </p>
          </div>
        </div>

        {health.unresponded > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {health.unresponded} mensagem(ns) sem resposta nas últimas 24h
          </div>
        )}
      </CardContent>
    </Card>
  )
}
