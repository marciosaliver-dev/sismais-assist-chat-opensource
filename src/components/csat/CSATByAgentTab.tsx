import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarIcon, Star, Users, TrendingUp, BarChart3 } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface AgentCSATRow {
  agent_id: string
  agent_name: string
  avatar_url: string | null
  total_conversations: number
  total_rated: number
  rate_pct: number
  avg_score: number | null
  distribution: number[] // index 0=unused, 1-5
}

function StarScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">--</span>
  const full = Math.round(score)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn('h-3.5 w-3.5', i <= full ? 'fill-[#FFB800] text-[#FFB800]' : 'text-gray-300')}
        />
      ))}
      <span className="ml-1 text-sm font-semibold">{score.toFixed(1)}</span>
    </span>
  )
}

function MiniDistribution({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution.slice(1), 1)
  const colors = ['', '#DC2626', '#EA580C', '#FFB800', '#45E5E5', '#16A34A']

  return (
    <div className="flex items-end gap-0.5 h-6">
      {[1, 2, 3, 4, 5].map((i) => {
        const count = distribution[i] || 0
        const h = Math.max((count / max) * 100, 8)
        return (
          <div
            key={i}
            className="w-4 rounded-sm transition-all"
            style={{ height: `${h}%`, backgroundColor: colors[i], opacity: count > 0 ? 1 : 0.25 }}
            title={`${i}★: ${count}`}
          />
        )
      })}
    </div>
  )
}

export function CSATByAgentTab() {
  const [startDate, setStartDate] = useState<Date | undefined>(() => subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [period, setPeriod] = useState('30d')

  function handlePeriodChange(val: string) {
    setPeriod(val)
    if (val === '7d') { setStartDate(subDays(new Date(), 7)); setEndDate(undefined) }
    else if (val === '30d') { setStartDate(subDays(new Date(), 30)); setEndDate(undefined) }
    else if (val === '90d') { setStartDate(subDays(new Date(), 90)); setEndDate(undefined) }
    else { setStartDate(undefined); setEndDate(undefined) }
  }

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['csat-by-agent', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      // Busca conversas finalizadas no período com human_agent_id
      let query = db
        .from('ai_conversations')
        .select('id, human_agent_id, human_agents(id, name, avatar_url), csat_score')
        .eq('status', 'finalizado')
        .not('human_agent_id', 'is', null)

      if (startDate) query = query.gte('resolved_at', startOfDay(startDate).toISOString())
      if (endDate) query = query.lte('resolved_at', new Date(endDate.getTime() + 86400000).toISOString())

      const { data, error } = await query.limit(2000)
      if (error) throw error
      return data || []
    },
  })

  const agents = useMemo<AgentCSATRow[]>(() => {
    if (!rawData?.length) return []

    const map = new Map<string, {
      name: string
      avatar_url: string | null
      total: number
      rated: number
      scores: number[]
      dist: number[]
    }>()

    for (const c of rawData) {
      const agentId = c.human_agent_id
      const agent = c.human_agents as any
      if (!agentId || !agent) continue

      if (!map.has(agentId)) {
        map.set(agentId, {
          name: agent.name || 'Sem nome',
          avatar_url: agent.avatar_url || null,
          total: 0,
          rated: 0,
          scores: [],
          dist: [0, 0, 0, 0, 0, 0],
        })
      }

      const entry = map.get(agentId)!
      entry.total++

      const score = c.csat_score
      if (typeof score === 'number' && score >= 1 && score <= 5) {
        entry.rated++
        entry.scores.push(score)
        entry.dist[score]++
      }
    }

    return Array.from(map.entries())
      .map(([id, e]) => ({
        agent_id: id,
        agent_name: e.name,
        avatar_url: e.avatar_url,
        total_conversations: e.total,
        total_rated: e.rated,
        rate_pct: e.total > 0 ? (e.rated / e.total) * 100 : 0,
        avg_score: e.scores.length > 0
          ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length
          : null,
        distribution: e.dist,
      }))
      .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))
  }, [rawData])

  const totals = useMemo(() => {
    const totalConvs = agents.reduce((s, a) => s + a.total_conversations, 0)
    const totalRated = agents.reduce((s, a) => s + a.total_rated, 0)
    const allScores = agents.flatMap((a) =>
      a.distribution.slice(1).flatMap((count, idx) => Array(count).fill(idx + 1))
    )
    const avgScore = allScores.length > 0
      ? allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length
      : null
    return { totalConvs, totalRated, avgScore, ratePct: totalConvs > 0 ? (totalRated / totalConvs) * 100 : 0 }
  }, [agents])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {period === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-9 w-[130px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {startDate ? format(startDate, 'dd/MM/yy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-9 w-[130px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {endDate ? format(endDate, 'dd/MM/yy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <Users className="h-4 w-4 text-[#10293F]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Agentes Ativos</p>
                <p className="text-xl font-bold text-[#10293F] dark:text-foreground">{agents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-[#10293F]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Atendimentos</p>
                <p className="text-xl font-bold text-[#10293F] dark:text-foreground">{totals.totalConvs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#10293F]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Avaliação</p>
                <p className="text-xl font-bold text-[#10293F] dark:text-foreground">{totals.ratePct.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FFFBEB] flex items-center justify-center">
                <Star className="h-4 w-4 fill-[#FFB800] text-[#FFB800]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nota Média Geral</p>
                <p className="text-xl font-bold text-[#10293F] dark:text-foreground">
                  {totals.avgScore !== null ? totals.avgScore.toFixed(1) : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {agents.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum atendimento finalizado por agentes humanos no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border overflow-hidden">
          <div className="bg-[#10293F] px-5 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#45E5E5]" />
            <span className="text-sm font-semibold text-white">Avaliação por Agente</span>
            <span className="text-xs text-white/50 ml-auto">{agents.length} agentes</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Agente</TableHead>
                  <TableHead className="font-semibold text-center">Atendimentos</TableHead>
                  <TableHead className="font-semibold text-center">Avaliados</TableHead>
                  <TableHead className="font-semibold text-center">% Avaliação</TableHead>
                  <TableHead className="font-semibold text-center">Nota Média</TableHead>
                  <TableHead className="font-semibold text-center">Distribuição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.agent_id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#10293F] text-[#45E5E5] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {agent.agent_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{agent.agent_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">{agent.total_conversations}</TableCell>
                    <TableCell className="text-center text-sm">{agent.total_rated}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(agent.rate_pct, 100)}%`,
                              backgroundColor: agent.rate_pct >= 50 ? '#16A34A' : agent.rate_pct >= 25 ? '#FFB800' : '#DC2626',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10 text-right">{agent.rate_pct.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <StarScore score={agent.avg_score} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <MiniDistribution distribution={agent.distribution} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
