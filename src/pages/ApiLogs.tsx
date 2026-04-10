import { useState, useMemo } from 'react'
import {
  Activity, DollarSign, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Filter, RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────
interface ApiLog {
  id: string
  created_at: string
  edge_function: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number | null
  status: string
  error_message: string | null
  conversation_id: string | null
  agent_id: string | null
  request_summary: any
  response_summary: any
}

// ─── Constants ────────────────────────────────────────────────
const PAGE_SIZE = 50

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Todos' },
] as const

function getStartDate(period: string): string | null {
  const now = new Date()
  switch (period) {
    case 'today': return startOfDay(now).toISOString()
    case '7d': return subDays(now, 7).toISOString()
    case '30d': return subDays(now, 30).toISOString()
    default: return null
  }
}

// ─── Hooks ────────────────────────────────────────────────────
function useApiLogs(
  period: string,
  edgeFunction: string,
  status: string,
  page: number,
) {
  return useQuery({
    queryKey: ['api-logs', period, edgeFunction, status, page],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_api_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const startDate = getStartDate(period)
      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (edgeFunction && edgeFunction !== 'all') {
        query = query.eq('edge_function', edgeFunction)
      }
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: (data || []) as ApiLog[], total: count || 0 }
    },
  })
}

function useApiLogStats(period: string) {
  return useQuery({
    queryKey: ['api-log-stats', period],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_api_logs')
        .select('cost_usd, latency_ms, status')

      const startDate = getStartDate(period)
      if (startDate) {
        query = query.gte('created_at', startDate)
      }

      const { data, error } = await query
      if (error) throw error
      const rows = (data || []) as ApiLog[]

      const totalCalls = rows.length
      const totalCost = rows.reduce((s, r) => s + (r.cost_usd || 0), 0)
      const latencies = rows.filter(r => r.latency_ms != null).map(r => r.latency_ms!)
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
        : 0
      const errorCount = rows.filter(r => r.status === 'error' || r.status === 'timeout').length
      const errorRate = totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0

      return { totalCalls, totalCost, avgLatency, errorRate }
    },
  })
}

function useEdgeFunctions(period: string) {
  return useQuery({
    queryKey: ['api-log-functions', period],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_api_logs')
        .select('edge_function')

      const startDate = getStartDate(period)
      if (startDate) {
        query = query.gte('created_at', startDate)
      }

      const { data, error } = await query
      if (error) throw error
      const unique = [...new Set((data || []).map((r: any) => r.edge_function).filter(Boolean))]
      return unique.sort() as string[]
    },
  })
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    timeout: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-semibold', variants[status] || variants.success)}
    >
      {status}
    </Badge>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function ApiLogs() {
  const [period, setPeriod] = useState('7d')
  const [edgeFunction, setEdgeFunction] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const { data: stats, isLoading: statsLoading } = useApiLogStats(period)
  const { data: logsData, isLoading: logsLoading, refetch } = useApiLogs(period, edgeFunction, statusFilter, page)
  const { data: functions } = useEdgeFunctions(period)

  const logs = logsData?.rows || []
  const totalCount = logsData?.total || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const metrics = [
    {
      label: 'Total Calls',
      value: stats?.totalCalls?.toLocaleString('pt-BR') || '0',
      icon: Activity,
      color: 'text-[#45E5E5]',
      bg: 'bg-[#E8F9F9]',
    },
    {
      label: 'Custo Total (USD)',
      value: stats ? `$${stats.totalCost.toFixed(4)}` : '$0.00',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Latência Média (ms)',
      value: stats?.avgLatency?.toLocaleString('pt-BR') || '0',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Taxa de Erro (%)',
      value: stats ? `${stats.errorRate.toFixed(1)}%` : '0%',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ]

  function handlePeriodChange(v: string) {
    setPeriod(v)
    setPage(0)
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(0) }
  }

  return (
    <div className="page-container"><div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#10293F]">Log de API Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount.toLocaleString('pt-BR')} registros encontrados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', m.bg)}>
                <m.icon className={cn('h-5 w-5', m.color)} />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <p className="text-xl font-bold text-[#10293F]">{m.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={edgeFunction} onValueChange={handleFilterChange(setEdgeFunction)}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Edge Function" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            {(functions || []).map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
                <TableHead className="text-white/80 w-8" />
                <TableHead className="text-white/80">Data/Hora</TableHead>
                <TableHead className="text-white/80">Edge Function</TableHead>
                <TableHead className="text-white/80">Modelo</TableHead>
                <TableHead className="text-white/80 text-right">Tokens (P/C)</TableHead>
                <TableHead className="text-white/80 text-right">Custo USD</TableHead>
                <TableHead className="text-white/80 text-right">Latência ms</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum log encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedRow === log.id
                  return (
                    <tbody key={log.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <TableCell className="w-8 px-2">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="text-[13px] whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-[13px] font-medium">
                          {log.edge_function}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground max-w-[180px] truncate">
                          {log.model || '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums">
                          {(log.prompt_tokens || 0).toLocaleString('pt-BR')} / {(log.completion_tokens || 0).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums font-medium">
                          ${(log.cost_usd || 0).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums">
                          {log.latency_ms != null ? log.latency_ms.toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-muted/30 p-4 border-b">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {log.error_message && (
                                <div className="col-span-full">
                                  <p className="text-xs font-semibold text-red-600 mb-1">Erro</p>
                                  <pre className="text-xs bg-red-50 text-red-800 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap border border-red-200">
                                    {log.error_message}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Request Summary</p>
                                <pre className="text-xs bg-card p-3 rounded-lg overflow-x-auto max-h-[240px] overflow-y-auto border border-border">
                                  {log.request_summary
                                    ? JSON.stringify(log.request_summary, null, 2)
                                    : '—'}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Response Summary</p>
                                <pre className="text-xs bg-card p-3 rounded-lg overflow-x-auto max-h-[240px] overflow-y-auto border border-border">
                                  {log.response_summary
                                    ? JSON.stringify(log.response_summary, null, 2)
                                    : '—'}
                                </pre>
                              </div>
                              <div className="col-span-full flex gap-4 text-xs text-muted-foreground">
                                {log.conversation_id && <span>Conversa: <code className="font-mono">{log.conversation_id}</code></span>}
                                {log.agent_id && <span>Agente: <code className="font-mono">{log.agent_id}</code></span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div></div>
  )
}
