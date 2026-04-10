import { Megaphone, Send, MessageSquare, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import { useCampaignStats } from '@/hooks/useCampaigns'
import { Skeleton } from '@/components/ui/skeleton'

export function CampaignStatsRow() {
  const { data: stats, isLoading } = useCampaignStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  const cards = [
    { label: 'Campanhas', value: stats?.totalCampaigns ?? 0, sub: `${stats?.activeCampaigns ?? 0} ativas`, icon: Megaphone, color: 'text-primary', iconBg: 'bg-primary/10' },
    { label: 'Contatos Enviados', value: stats?.totalContacted ?? 0, icon: Send, color: 'text-blue-600', iconBg: 'bg-blue-500/10' },
    { label: 'Respostas', value: stats?.totalReplied ?? 0, sub: `${stats?.responseRate}% taxa`, icon: MessageSquare, color: 'text-emerald-600', iconBg: 'bg-emerald-500/10' },
    { label: 'Convertidos', value: stats?.totalConverted ?? 0, icon: TrendingUp, color: 'text-violet-600', iconBg: 'bg-violet-500/10' },
    { label: 'Falhas', value: stats?.totalFailed ?? 0, icon: AlertCircle, color: 'text-red-600', iconBg: 'bg-red-500/10' },
    { label: 'Aguardando Aprovação', value: stats?.pendingApprovals ?? 0, icon: Clock, color: 'text-amber-600', iconBg: 'bg-amber-500/10' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
          </div>
        )
      })}
    </div>
  )
}
