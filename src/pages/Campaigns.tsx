import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Megaphone, Search, Loader2, FileText, Play } from 'lucide-react'
import { useCampaigns } from '@/hooks/useCampaigns'
import { CampaignStatsRow } from '@/components/campaigns/CampaignStatsRow'
import { CampaignListCard } from '@/components/campaigns/CampaignListCard'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'
import { CampaignDetailDialog } from '@/components/campaigns/CampaignDetailDialog'
import { PendingApprovalsPanel } from '@/components/campaigns/PendingApprovalsPanel'
import type { Campaign } from '@/hooks/useCampaigns'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { normalizeText } from '@/lib/utils'

export default function Campaigns() {
  const { campaigns, isLoading, deleteCampaign, toggleCampaign, createCampaign } = useCampaigns()

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)

  const filtered = useMemo(() => {
    let items = campaigns ?? []
    if (search) {
      const q = normalizeText(search)
      items = items.filter(c => normalizeText(c.name).includes(q) || normalizeText(c.description || '').includes(q))
    }
    if (typeFilter !== 'all') items = items.filter(c => c.campaign_type === typeFilter)
    if (tab === 'active') items = items.filter(c => c.is_active)
    if (tab === 'paused') items = items.filter(c => !c.is_active && c.status !== 'draft')
    if (tab === 'draft') items = items.filter(c => c.status === 'draft')
    return items
  }, [campaigns, search, typeFilter, tab])

  const handleRunNow = async (campaign: Campaign) => {
    try {
      toast.info('Executando campanha...')
      const { data, error } = await supabase.functions.invoke('proactive-campaign-scheduler', {
        body: {}
      })
      if (error) throw error
      toast.success('Campanha avaliada com sucesso!')
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`)
    }
  }

  const handleDuplicate = (campaign: Campaign) => {
    createCampaign.mutate({
      name: `${campaign.name} (cópia)`,
      description: campaign.description || undefined,
      campaign_type: campaign.campaign_type,
      approval_mode: campaign.approval_mode,
      schedule_cron: campaign.schedule_cron || undefined,
      target_rules: campaign.target_rules,
      message_mode: campaign.message_mode,
      message_template: campaign.message_template || undefined,
      message_prompt: campaign.message_prompt || undefined,
      agent_id: campaign.agent_id || undefined,
      whatsapp_instance_id: campaign.whatsapp_instance_id || undefined,
      max_contacts_per_run: campaign.max_contacts_per_run,
      max_contacts_per_day: campaign.max_contacts_per_day,
      min_hours_between_contacts: campaign.min_hours_between_contacts,
    })
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> Campanhas Proativas
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contato ativo autônomo com clientes — follow-up, cobrança, onboarding e reativação
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Campanha
          </Button>
        </div>

        {/* Stats */}
        <CampaignStatsRow />

        {/* Pending Approvals */}
        <PendingApprovalsPanel />

        {/* Tabs & Filters */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="active">Ativas</TabsTrigger>
              <TabsTrigger value="paused">Pausadas</TabsTrigger>
              <TabsTrigger value="draft">Rascunhos</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar campanha..."
                  className="pl-8 h-9 w-[200px]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="billing">Cobrança</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="reactivation">Reativação</SelectItem>
                  <SelectItem value="health_check">Health Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign list */}
          {['all', 'active', 'paused', 'draft'].map(tabValue => (
            <TabsContent key={tabValue} value={tabValue} className="mt-4 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha encontrada</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Crie sua primeira campanha proativa</p>
                  <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Campanha
                  </Button>
                </div>
              ) : (
                filtered.map(c => (
                  <CampaignListCard
                    key={c.id}
                    campaign={c}
                    onEdit={() => setDetailCampaign(c)}
                    onDelete={(id) => deleteCampaign.mutate(id)}
                    onToggle={(id, active) => toggleCampaign.mutate({ id, active })}
                    onViewDetails={(c) => setDetailCampaign(c)}
                    onDuplicate={handleDuplicate}
                    onRunNow={handleRunNow}
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialogs */}
        <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
        <CampaignDetailDialog
          campaign={detailCampaign}
          open={!!detailCampaign}
          onOpenChange={() => setDetailCampaign(null)}
        />
      </div>
    </div>
  )
}
