import { useQuery } from '@tanstack/react-query'
import { Bot, Users, Star, TrendingUp } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface KPI {
  label: string
  value: string
  icon: React.ElementType
  description: string
  color: string
}

export function SupervisorKPIs() {
  const { data, isLoading } = useQuery({
    queryKey: ['supervisor_kpis'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()

      const [convRes, msgRes] = await Promise.all([
        supabase
          .from('ai_conversations')
          .select('handler_type, status')
          .gte('created_at', todayStr),
        supabase
          .from('ai_messages')
          .select('confidence, role')
          .eq('role', 'assistant')
          .gte('created_at', todayStr),
      ])

      const convs = convRes.data || []
      const msgs = msgRes.data || []

      const total = convs.length || 1
      const resolvedByAI = convs.filter(c => c.handler_type === 'ai' && c.status === 'finalizado').length
      const escalated = convs.filter(c => c.handler_type === 'human').length
      const aiPct = Math.round((resolvedByAI / total) * 100)
      const escalatePct = Math.round((escalated / total) * 100)

      const confidences = msgs.map(m => m.confidence).filter(Boolean) as number[]
      const avgConf = confidences.length
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null

      return { aiPct, escalatePct, avgConf, totalToday: convs.length }
    },
    refetchInterval: 60_000,
  })

  const kpis: KPI[] = [
    {
      label: 'IA Resolveu',
      value: isLoading ? '...' : `${data?.aiPct ?? 0}%`,
      icon: Bot,
      description: 'conversas resolvidas pela IA hoje',
      color: 'text-emerald-500',
    },
    {
      label: 'Escaladas',
      value: isLoading ? '...' : `${data?.escalatePct ?? 0}%`,
      icon: Users,
      description: 'transferidas para humano hoje',
      color: 'text-orange-500',
    },
    {
      label: 'Confiança Média',
      value: isLoading ? '...' : data?.avgConf ? `${data.avgConf}%` : 'N/A',
      icon: TrendingUp,
      description: 'das respostas de IA hoje',
      color: 'text-blue-500',
    },
    {
      label: 'Total Hoje',
      value: isLoading ? '...' : String(data?.totalToday ?? 0),
      icon: Star,
      description: 'conversas iniciadas hoje',
      color: 'text-purple-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map(kpi => (
        <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
          </div>
          <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
        </div>
      ))}
    </div>
  )
}
