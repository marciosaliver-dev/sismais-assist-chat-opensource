import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare, CheckCircle2, Star, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMetric } from '@/hooks/useAgentMetrics'
import { specialtyMap } from '@/components/agents/agent-specialties'

interface AgentAnalyticsProps {
  metrics: AgentMetric[]
}

type SortKey = 'agent_name' | 'conversations_today' | 'resolution_rate' | 'avg_csat' | 'avg_confidence' | 'escalation_rate'
type SortDir = 'asc' | 'desc'

export function AgentAnalytics({ metrics }: AgentAnalyticsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('conversations_today')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...metrics].sort((a, b) => {
    const av = a[sortKey] as number | string
    const bv = b[sortKey] as number | string
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const topPerformer = [...metrics].sort((a, b) => b.resolution_rate - a.resolution_rate)[0]

  // Global metrics
  const totalConversations = metrics.reduce((s, m) => s + m.conversations_today, 0)
  const avgResolution = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + m.resolution_rate, 0) / metrics.length)
    : 0
  const avgCsat = metrics.length
    ? (metrics.reduce((s, m) => s + m.avg_csat, 0) / metrics.length).toFixed(1)
    : '0.0'
  // Estimativa: R$15 economizados por conversa IA (vs humano)
  const savings = (metrics.reduce((s, m) => s + m.conversations_today, 0) * 15).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-[#45E5E5]" />
      : <ChevronDown className="w-3.5 h-3.5 text-[#45E5E5]" />
  }

  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => handleSort(k)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon k={k} />
      </div>
    </TableHead>
  )

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            Conversas hoje
          </div>
          <p className="text-2xl font-bold text-foreground">{totalConversations}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Taxa resolução IA
          </div>
          <p className="text-2xl font-bold text-foreground">{avgResolution}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Star className="w-3.5 h-3.5 text-[#FFB800]" />
            CSAT médio
          </div>
          <p className="text-2xl font-bold text-foreground">{avgCsat}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            Economia est. hoje
          </div>
          <p className="text-2xl font-bold text-foreground">{savings}</p>
        </div>
      </div>

      {/* Ranking table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Ranking de Agentes</p>
          <Badge variant="outline" className="text-xs">Últimas 24h</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th label="Agente" k="agent_name" />
                <Th label="Conv. hoje" k="conversations_today" />
                <Th label="Resolução" k="resolution_rate" />
                <Th label="CSAT" k="avg_csat" />
                <Th label="Confiança" k="avg_confidence" />
                <Th label="Escalações" k="escalation_rate" />
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => {
                const spec = specialtyMap[m.specialty] || { emoji: '🤖', label: m.specialty }
                const isTop = topPerformer?.agent_id === m.agent_id
                return (
                  <TableRow
                    key={m.agent_id}
                    className={cn(isTop && 'border-l-2 border-l-[#45E5E5] bg-[#45E5E5]/5')}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: `${m.color}20` }}
                        >
                          {spec.emoji}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-foreground leading-none">{m.agent_name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{spec.label}</p>
                        </div>
                        {isTop && (
                          <span className="ml-1 text-[10px] font-bold bg-[#45E5E5] text-[#10293F] px-1.5 py-0.5 rounded-full">TOP</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{m.conversations_today}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(m.resolution_rate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm">{Math.round(m.resolution_rate)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-semibold',
                        m.avg_csat >= 4.5 ? 'text-emerald-600' :
                        m.avg_csat >= 3.5 ? 'text-[#FFB800]' : 'text-destructive'
                      )}>
                        {m.avg_csat.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>{Math.round(m.avg_confidence * 100)}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingDown className={cn(
                          'w-3 h-3',
                          m.escalation_rate > 30 ? 'text-destructive' : 'text-emerald-500'
                        )} />
                        <span>{Math.round(m.escalation_rate)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5',
                          m.is_active
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        {m.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma métrica disponível ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
