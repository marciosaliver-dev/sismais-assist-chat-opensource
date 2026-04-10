import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, Play, Eye, Copy, Clock } from 'lucide-react'
import { CAMPAIGN_TYPES, APPROVAL_LABELS } from './CampaignTypeConfig'
import type { Campaign } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'

interface CampaignListCardProps {
  campaign: Campaign
  onEdit: (campaign: Campaign) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onViewDetails: (campaign: Campaign) => void
  onDuplicate: (campaign: Campaign) => void
  onRunNow: (campaign: Campaign) => void
}

export function CampaignListCard({
  campaign, onEdit, onDelete, onToggle, onViewDetails, onDuplicate, onRunNow
}: CampaignListCardProps) {
  const typeConfig = CAMPAIGN_TYPES[campaign.campaign_type]
  const approvalConfig = APPROVAL_LABELS[campaign.approval_mode]
  const Icon = typeConfig?.icon

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-emerald-500/10 text-emerald-600',
    paused: 'bg-amber-500/10 text-amber-600',
    completed: 'bg-blue-500/10 text-blue-600',
    archived: 'bg-muted text-muted-foreground',
  }

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativa',
    paused: 'Pausada',
    completed: 'Concluída',
    archived: 'Arquivada',
  }

  return (
    <Card className="group hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', typeConfig?.color || 'bg-muted')}>
            {Icon && <Icon className="w-5 h-5 text-white" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
              <Badge variant="secondary" className={cn('text-xs', statusColors[campaign.status])}>
                {statusLabels[campaign.status]}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', approvalConfig?.color)}>
                {approvalConfig?.label}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className={cn('text-xs', typeConfig?.colorLight)}>
                {typeConfig?.label}
              </Badge>
              {campaign.schedule_cron && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {campaign.schedule_cron}
                </span>
              )}
              {campaign.last_run_at && (
                <span>
                  Última exec: {new Date(campaign.last_run_at).toLocaleDateString('pt-BR')}
                </span>
              )}
              {campaign.next_run_at && campaign.is_active && (
                <span className="text-emerald-600">
                  Próxima: {new Date(campaign.next_run_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={campaign.is_active}
              onCheckedChange={(v) => onToggle(campaign.id, v)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(campaign)}>
                  <Eye className="w-4 h-4 mr-2" /> Ver Detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(campaign)}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRunNow(campaign)}>
                  <Play className="w-4 h-4 mr-2" /> Executar Agora
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(campaign.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
