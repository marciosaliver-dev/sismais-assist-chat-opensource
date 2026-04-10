import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle, Clock, Users, AlertTriangle } from 'lucide-react'
import { usePendingApprovals } from '@/hooks/useCampaigns'
import { CAMPAIGN_TYPES } from './CampaignTypeConfig'
import { cn } from '@/lib/utils'

export function PendingApprovalsPanel() {
  const { pendingExecutions, isLoading, approveExecution, rejectExecution } = usePendingApprovals()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  if (isLoading) return null
  if (!pendingExecutions?.length) return null

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Execuções Aguardando Aprovação
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
            {pendingExecutions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingExecutions.map((exec: any) => {
          const campaign = exec.proactive_campaigns
          const typeConfig = campaign ? CAMPAIGN_TYPES[campaign.campaign_type as keyof typeof CAMPAIGN_TYPES] : null
          const Icon = typeConfig?.icon || Clock

          return (
            <div key={exec.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', typeConfig?.color || 'bg-muted')}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{campaign?.name || 'Campanha'}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {typeConfig?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {exec.total_targets} contatos
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(exec.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>

                {rejectingId === exec.id ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      size={1}
                      placeholder="Motivo da rejeição..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      onClick={() => {
                        rejectExecution.mutate({ id: exec.id, reason: rejectReason })
                        setRejectingId(null)
                        setRejectReason('')
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => { setRejectingId(null); setRejectReason('') }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => approveExecution.mutate(exec.id)}
                      disabled={approveExecution.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive"
                      onClick={() => setRejectingId(exec.id)}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
