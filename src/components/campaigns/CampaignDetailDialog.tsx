import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CampaignExecutionHistory } from './CampaignExecutionHistory'
import { CAMPAIGN_TYPES, APPROVAL_LABELS, SCHEDULE_PRESETS } from './CampaignTypeConfig'
import type { Campaign } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'
import { Clock, Bot, Smartphone, Target, MessageSquare, Shield } from 'lucide-react'

interface Props {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignDetailDialog({ campaign, open, onOpenChange }: Props) {
  if (!campaign) return null

  const typeConfig = CAMPAIGN_TYPES[campaign.campaign_type]
  const approvalConfig = APPROVAL_LABELS[campaign.approval_mode]
  const Icon = typeConfig?.icon
  const scheduleLabel = SCHEDULE_PRESETS.find(p => p.value === campaign.schedule_cron)?.label || campaign.schedule_cron

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', typeConfig?.color)}>
              {Icon && <Icon className="w-5 h-5 text-white" />}
            </div>
            <div>
              <DialogTitle>{campaign.name}</DialogTitle>
              {campaign.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{campaign.description}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="executions">Execuções</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn(typeConfig?.colorLight)}>{typeConfig?.label}</Badge>
              <Badge className={cn(approvalConfig?.color)}>{approvalConfig?.label}</Badge>
              <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                {campaign.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>

            {/* Config grid */}
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={Clock} label="Agendamento" value={scheduleLabel || 'Não agendada'} />
              <InfoCard icon={Shield} label="Aprovação" value={approvalConfig?.description || ''} />
              <InfoCard icon={Target} label="Máx por execução" value={`${campaign.max_contacts_per_run} contatos`} />
              <InfoCard icon={Target} label="Máx por dia" value={`${campaign.max_contacts_per_day} contatos`} />
              <InfoCard icon={Clock} label="Intervalo mínimo" value={`${campaign.min_hours_between_contacts}h entre contatos`} />
              <InfoCard icon={MessageSquare} label="Modo de mensagem" value={campaign.message_mode === 'ai_generated' ? 'IA Personalizada' : 'Template'} />
            </div>

            {/* AI prompt */}
            {campaign.message_prompt && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" /> Instruções para IA
                </p>
                <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                  {campaign.message_prompt}
                </div>
              </div>
            )}

            {/* Next/Last run */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {campaign.last_run_at && (
                <span>Última execução: {new Date(campaign.last_run_at).toLocaleString('pt-BR')}</span>
              )}
              {campaign.next_run_at && campaign.is_active && (
                <span className="text-emerald-600">
                  Próxima: {new Date(campaign.next_run_at).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="executions" className="mt-4">
            <CampaignExecutionHistory campaign={campaign} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}
