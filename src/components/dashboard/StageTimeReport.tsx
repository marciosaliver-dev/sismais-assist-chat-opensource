import { useState, useMemo } from 'react'
import { useStageTimeMetrics, formatDuration } from '@/hooks/useStageTimeMetrics'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { useDashboardFilters } from '@/contexts/DashboardFilterContext'
import { ReportKPICards } from '@/components/reports/ReportKPICards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Timer, AlertTriangle, BarChart3, Ticket, GitBranch } from 'lucide-react'
import { subDays } from 'date-fns'

const NAVY_TOOLTIP = {
  backgroundColor: '#10293F',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  boxShadow: '0 4px 14px rgba(16,41,63,0.3)',
}

export function StageTimeReport() {
  const { debouncedFilters } = useDashboardFilters()
  const { data: boards } = useKanbanBoards()
  const [boardId, setBoardId] = useState<string | null>(null)
  const [period, setPeriod] = useState('30')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [showFinalized, setShowFinalized] = useState(false)

  const endDate = useMemo(() => new Date(), [])
  const startDate = useMemo(() => subDays(endDate, parseInt(period)), [period, endDate])

  const selectedBoard = boardId || boards?.[0]?.id || null

  const {
    metrics,
    totalPipelineTime,
    slowestStage,
    totalTickets,
    bottleneckCount,
    agents,
    categories,
    isLoading,
  } = useStageTimeMetrics(selectedBoard, startDate, endDate, agentId, categoryId, {
    categoryIds: debouncedFilters.categoryIds,
    moduleIds: debouncedFilters.moduleIds,
    boardIds: debouncedFilters.boardIds,
    humanAgentIds: debouncedFilters.humanAgentIds,
    aiAgentIds: debouncedFilters.aiAgentIds,
  })

  const displayMetrics = showFinalized ? metrics : metrics.filter((m) => m.statusType !== 'finalizado')

  const bottlenecks = displayMetrics.filter((m) => m.isBottleneck)

  const funnelData = displayMetrics
    .filter((m) => m.entered > 0 || m.exited > 0)
    .map((m) => ({
      name: m.stageName,
      Entraram: m.entered,
      Saíram: m.exited,
    }))

  const hasWipColumn = displayMetrics.some((m) => m.wipLimit !== null)
  const hasFinalized = metrics.some((m) => m.statusType === 'finalizado')

  const kpis = [
    { icon: Timer, title: 'Tempo no Pipeline', value: formatDuration(totalPipelineTime), subtitle: 'Soma dos tempos médios', tooltip: 'Exclui a etapa de finalização do cálculo', accent: 'navy' as const },
    { icon: AlertTriangle, title: 'Etapa Mais Lenta', value: slowestStage?.stageName || '--', subtitle: slowestStage ? formatDuration(slowestStage.avgTimeMs) : '', tooltip: 'Etapas finalizadas não são consideradas', accent: 'error' as const },
    { icon: Ticket, title: 'Tickets Analisados', value: totalTickets, subtitle: `Últimos ${period} dias`, accent: 'cyan' as const },
    { icon: BarChart3, title: 'Gargalos', value: bottleneckCount, subtitle: bottleneckCount > 0 ? 'Etapas acima de 1.5x' : 'Nenhum gargalo', accent: 'yellow' as const },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={selectedBoard || ''} onValueChange={(v) => setBoardId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o board" />
              </SelectTrigger>
              <SelectContent>
                {(boards || []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={agentId || 'all'} onValueChange={(v) => setAgentId(v === 'all' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agents.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFinalized && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Switch
                id="show-finalized"
                checked={showFinalized}
                onCheckedChange={setShowFinalized}
              />
              <Label htmlFor="show-finalized" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar etapas finalizadas
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <ReportKPICards kpis={kpis} />

          {/* Alerts */}
          {bottlenecks.length > 0 && (
            <div className="space-y-2">
              {bottlenecks.map((b) => (
                <Card key={b.stageId} className="border-[rgba(255,184,0,0.5)] bg-[#FFFBEB]">
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FFB800] flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-[#10293F]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#10293F]">{b.stageName}</span>
                        <Badge className="text-[10px] bg-[#FFFBEB] text-[#92400E] border border-[rgba(255,184,0,0.5)] hover:bg-[#FFFBEB]">
                          Gargalo identificado
                        </Badge>
                      </div>
                      <p className="text-xs text-[#666666]">
                        Tempo médio de {formatDuration(b.avgTimeMs)} — {b.ticketCount} tickets passaram
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Table */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-[#10293F] py-3 px-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
                Tempo Médio por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {displayMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado de movimentação encontrado para este período.
                </p>
              ) : (
                <Table className="stagger-rows">
                  <TableHeader>
                    <TableRow className="bg-[#10293F] hover:bg-[#10293F] border-b-0">
                      <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Etapa</TableHead>
                      <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-right">Tickets</TableHead>
                      <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-right">T. Médio</TableHead>
                      <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-right">T. Mín</TableHead>
                      <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-right">T. Máx</TableHead>
                      {hasWipColumn && <TableHead className="text-white/80 text-[11px] font-semibold uppercase tracking-wider text-right">% WIP</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMetrics.map((m) => {
                      const isFinalizado = m.statusType === 'finalizado'
                      return (
                        <TableRow
                          key={m.stageId}
                          className={`hover:bg-[#F8FAFC] border-b border-[#F0F0F0] ${m.isBottleneck ? 'bg-[#FFFBEB]' : ''} ${isFinalizado ? 'opacity-50' : ''}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                              <span className="font-medium text-[#10293F] dark:text-foreground">{m.stageName}</span>
                              {m.isBottleneck && (
                                <AlertTriangle className="h-3.5 w-3.5 text-[#FFB800]" />
                              )}
                              {isFinalizado && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-muted">
                                  Excluída dos totais
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{m.ticketCount}</TableCell>
                          <TableCell className="text-right font-mono">{isFinalizado ? '--' : formatDuration(m.avgTimeMs)}</TableCell>
                          <TableCell className="text-right font-mono text-[#666666]">{isFinalizado ? '--' : formatDuration(m.minTimeMs)}</TableCell>
                          <TableCell className="text-right font-mono text-[#666666]">{isFinalizado ? '--' : formatDuration(m.maxTimeMs)}</TableCell>
                          {hasWipColumn && (
                            <TableCell className="text-right">
                              {m.wipLimit !== null ? `${m.wipPercentage ?? '--'}%` : '--'}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Funnel Chart */}
          {funnelData.length > 0 && (
            <Card className="border-border overflow-hidden">
              <CardHeader className="bg-[#10293F] py-3 px-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#45E5E5]" />
                  Funil de Etapas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={Math.max(200, funnelData.length * 50)}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                    <XAxis type="number" stroke="#666666" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={120} stroke="#666666" fontSize={12} />
                    <Tooltip contentStyle={NAVY_TOOLTIP} />
                    <Legend />
                    <Bar dataKey="Entraram" fill="#45E5E5" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Saíram" fill="#16A34A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
