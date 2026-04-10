import { useState, useMemo } from 'react'
import {
  Brain, DollarSign, Zap, MessageSquare, Clock, Download,
  ArrowUp, ArrowDown, BarChart3, Users, Cpu, TrendingUp, Trophy, Inbox, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAIConsumption, useAgentConsumption, useModelConsumption, useAIMessagesLog, useFeatureConsumption } from '@/hooks/useAIAnalytics'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { subDays, subMonths, subYears, startOfDay, format } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Bar, Line,
} from 'recharts'

// ─── Helpers ─────────────────────────────────────────────────
const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Smart micro-cost formatter: shows up to 6 decimal places for sub-cent values */
const formatCostBRL = (usd: number | null | undefined, rate: number): string => {
  if (usd == null) return '-'
  const brl = usd * rate
  if (brl === 0) return 'R$\u00a00,00'
  if (brl < 0.001) return `R$\u00a0${brl.toFixed(6).replace('.', ',')}`
  if (brl < 0.01) return `R$\u00a0${brl.toFixed(4).replace('.', ',')}`
  return brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const formatNumber = (v: number) => v.toLocaleString('pt-BR')

// ─── Hooks for real data ─────────────────────────────────────
const useHourlyStats = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-hourly-stats', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('created_at, total_tokens')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null)
      if (error) throw error
      const rows = (data || []) as any[]
      const byHour: Record<string, { volume: number }> = {}
      for (const r of rows) {
        const h = format(new Date(r.created_at), 'HH') + 'h'
        if (!byHour[h]) byHour[h] = { volume: 0 }
        byHour[h].volume += 1
      }
      return Object.entries(byHour).map(([hour, v]) => ({
        hour,
        volume: v.volume,
        avgTime: 0,
      }))
    },
  })
}

const useTopConversations = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-top-conversations', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('conversation_id, total_tokens, cost_usd, model_used')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null)
        .not('conversation_id', 'is', null)
      if (error) throw error
      const rows = (data || []) as any[]
      const grouped: Record<string, { tokens: number; cost: number; calls: number }> = {}
      for (const r of rows) {
        const cid = r.conversation_id
        if (!grouped[cid]) grouped[cid] = { tokens: 0, cost: 0, calls: 0 }
        grouped[cid].tokens += r.total_tokens || 0
        grouped[cid].cost += r.cost_usd || 0
        grouped[cid].calls += 1
      }
      const sorted = Object.entries(grouped)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)

      if (sorted.length === 0) return []
      const ids = sorted.map(s => s.id)
      const { data: convData } = await supabase
        .from('ai_conversations')
        .select('id, customer_name, agent:ai_agents(name)')
        .in('id', ids)
      const convMap: Record<string, any> = {}
      for (const c of (convData || []) as any[]) {
        convMap[c.id] = c
      }
      return sorted.map(s => ({
        id: s.id,
        customer: convMap[s.id]?.customer_name || 'Desconhecido',
        agent: convMap[s.id]?.agent?.name || '-',
        tokens: s.tokens,
        cost: s.cost,
        calls: s.calls,
      }))
    },
  })
}

// ─── Empty State ─────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Inbox className="w-12 h-12 mb-4 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[300px] w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────
const tabs = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { id: 'messages', label: 'Mensagens IA', icon: MessageSquare },
  { id: 'features', label: 'Por Feature', icon: Layers },
  { id: 'agents', label: 'Por Agente', icon: Users },
  { id: 'models', label: 'Por Modelo', icon: Cpu },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'top', label: 'Top Conversas', icon: Trophy },
] as const

type TabId = (typeof tabs)[number]['id']

// ─── KPI Card ────────────────────────────────────────────────
function KPICard({
  icon: Icon, title, value, trend, loading, noData,
}: {
  icon: React.ElementType; title: string; value: string; trend?: number; loading?: boolean; noData?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 border-t-[3px] border-t-[#45E5E5] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#E8F9F9] flex items-center justify-center">
          <Icon className="w-[18px] h-[18px] text-[#10293F]" />
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded',
            trend >= 0 ? 'text-[#16A34A] bg-[#F0FDF4]' : 'text-[#DC2626] bg-[#FEF2F2]'
          )}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-[28px] font-bold text-[#10293F] dark:text-foreground tracking-tight leading-none font-[Poppins,Inter,system-ui,sans-serif]">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {title}{noData && ' (sem dados)'}
      </p>
    </div>
  )
}

// ─── Tab Contents ────────────────────────────────────────────
function OverviewTab({ dailyData, loading }: { dailyData: { date: string; cost: number; tokens: number }[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (dailyData.length === 0) return <EmptyState message="Nenhum dado de consumo registrado neste período" />

  // Calculate token distribution from daily data
  const totalTokens = dailyData.reduce((s, d) => s + d.tokens, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução Custo / Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="url(#colorCost)" name="Custo (R$)" />
              <Area yAxisId="right" type="monotone" dataKey="tokens" stroke="hsl(var(--accent))" fill="url(#colorTokens)" name="Tokens" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {totalTokens > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Total de <span className="font-semibold text-foreground">{formatNumber(totalTokens)}</span> tokens consumidos no período
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AgentsTab({ agents, loading, rate }: { agents: { agent_name: string; total_calls: number; total_cost_usd: number; total_tokens: number }[]; loading: boolean; rate: number }) {
  if (loading) return <LoadingSkeleton />
  if (agents.length === 0) return <EmptyState message="Nenhum dado de consumo por agente neste período" />

  const maxCost = Math.max(...agents.map(a => a.total_cost_usd), 1)
  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <Card key={agent.agent_name}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {agent.agent_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm truncate">{agent.agent_name}</p>
                <p className="text-sm font-semibold text-primary">{formatBRL(agent.total_cost_usd * rate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={(agent.total_cost_usd / maxCost) * 100} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{agent.total_calls} chamadas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ModelsTab({ models, loading, rate }: { models: { model_name: string; provider: string; total_calls: number; total_cost_usd: number; total_tokens: number }[]; loading: boolean; rate: number }) {
  if (loading) return <LoadingSkeleton />
  if (models.length === 0) return <EmptyState message="Nenhum dado de consumo por modelo neste período" />

  const maxCost = Math.max(...models.map(m => m.total_cost_usd), 1)
  return (
    <div className="space-y-3">
      {models.map((model) => (
        <Card key={model.model_name}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm truncate">{model.model_name}</p>
                <p className="text-sm font-semibold text-primary">{formatBRL(model.total_cost_usd * rate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={(model.total_cost_usd / maxCost) * 100} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{model.total_calls} chamadas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PerformanceTab({ data, loading }: { data: { hour: string; volume: number; avgTime: number }[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (data.length === 0) return <EmptyState message="Nenhum dado de performance neste período" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Volume e Tempo de Resposta por Hora</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
            <Legend />
            <Bar yAxisId="left" dataKey="volume" fill="hsl(var(--primary))" name="Chamadas" radius={[4, 4, 0, 0]} opacity={0.7} />
            <Line yAxisId="right" type="monotone" dataKey="avgTime" stroke="hsl(var(--accent))" strokeWidth={2} name="Tempo Médio (s)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function TopConversationsTab({ data, loading, rate }: { data: { id: string; customer: string; agent: string; tokens: number; cost: number; calls: number }[]; loading: boolean; rate: number }) {
  if (loading) return <LoadingSkeleton />
  if (data.length === 0) return <EmptyState message="Nenhuma conversa com consumo de IA neste período" />

  return (
    <div className="space-y-3">
      {data.map((conv, idx) => (
        <Card key={conv.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-bold">
                #{idx + 1}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{conv.customer}</p>
                <p className="text-xs text-muted-foreground">Agente: {conv.agent}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-primary">{formatNumber(conv.tokens)}</p>
                <p className="text-xs text-muted-foreground">Tokens</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{formatBRL(conv.cost * rate)}</p>
                <p className="text-xs text-muted-foreground">Custo</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{conv.calls}</p>
                <p className="text-xs text-muted-foreground">Chamadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MessagesLogTab({ data, loading, rate }: { data: any[]; loading: boolean; rate: number }) {
  if (loading) return <LoadingSkeleton />
  if (data.length === 0) return <EmptyState message="Nenhuma mensagem de IA com consumo registrada neste período" />

  // Period totals
  const totalPromptTokens = data.reduce((s, m) => s + (m.prompt_tokens || 0), 0)
  const totalCompletionTokens = data.reduce((s, m) => s + (m.completion_tokens || 0), 0)
  const totalTokens = data.reduce((s, m) => s + (m.total_tokens || 0), 0)
  const totalCostUsd = data.reduce((s, m) => s + (m.cost_usd || 0), 0)

  const intentBadge = (intent: string | null) => {
    if (intent === 'audio_transcription') return <Badge className="bg-blue-500/10 text-blue-600 border-blue-300 text-xs">🎤 Áudio</Badge>
    if (intent === 'image_transcription') return <Badge className="bg-purple-500/10 text-purple-600 border-purple-300 text-xs">🖼️ Imagem</Badge>
    if (intent === 'summarization') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-xs">📝 Resumo</Badge>
    return <Badge variant="outline" className="text-xs">💬 Chat</Badge>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Prompt</TableHead>
                <TableHead className="text-right">Compl.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Custo (R$)</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    <Badge variant="outline" className={msg.role === 'assistant' ? 'border-primary/30 text-primary' : ''}>
                      {msg.role === 'assistant' ? 'IA' : msg.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{intentBadge(msg.intent)}</TableCell>
                  <TableCell className="text-xs font-mono">{msg.model_used || '-'}</TableCell>
                  <TableCell className="text-right text-xs">{msg.prompt_tokens != null ? formatNumber(msg.prompt_tokens) : '-'}</TableCell>
                  <TableCell className="text-right text-xs">{msg.completion_tokens != null ? formatNumber(msg.completion_tokens) : '-'}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{formatNumber(msg.total_tokens)}</TableCell>
                  <TableCell className="text-right text-xs font-medium text-primary">
                    {formatCostBRL(msg.cost_usd, rate)}
                  </TableCell>
                  <TableCell className="text-xs">{msg.ai_agents?.name || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {msg.created_at ? format(new Date(msg.created_at), 'dd/MM HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="border-t-2 font-semibold bg-muted/30">
                <TableCell colSpan={3} className="text-sm">Total do Período</TableCell>
                <TableCell className="text-right text-xs">{formatNumber(totalPromptTokens)}</TableCell>
                <TableCell className="text-right text-xs">{formatNumber(totalCompletionTokens)}</TableCell>
                <TableCell className="text-right text-xs font-bold">{formatNumber(totalTokens)}</TableCell>
                <TableCell className="text-right text-xs font-bold text-primary">{formatCostBRL(totalCostUsd, rate)}</TableCell>
                <TableCell colSpan={2} className="text-xs text-muted-foreground">{data.length} registros</TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat / Resposta',
  embedding: 'Embedding',
  tts: 'Text-to-Speech',
  ocr: 'OCR / Visão',
  transcription: 'Transcrição Áudio',
  copilot: 'Copiloto',
  summarization: 'Resumo',
}

const FEATURE_COLORS = ['#45E5E5', '#FFB800', '#7C3AED', '#16A34A', '#2563EB', '#DC2626', '#EA580C']

function FeaturesTab({ features, loading, rate }: { features: { feature: string; total_calls: number; total_cost_usd: number; total_input_tokens: number; total_output_tokens: number }[]; loading: boolean; rate: number }) {
  if (loading) return <LoadingSkeleton />
  if (features.length === 0) return <EmptyState message="Nenhum dado de consumo por feature neste período. Dados serão registrados após novas chamadas de IA." />

  const totalCost = features.reduce((s, f) => s + f.total_cost_usd, 0)
  const pieData = features.map((f, i) => ({
    name: FEATURE_LABELS[f.feature] || f.feature,
    value: f.total_cost_usd,
    fill: FEATURE_COLORS[i % FEATURE_COLORS.length],
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição de Custo por Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={true}>
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v * rate)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {features.map((f, i) => {
            const pct = totalCost > 0 ? (f.total_cost_usd / totalCost) * 100 : 0
            return (
              <Card key={f.feature}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${FEATURE_COLORS[i % FEATURE_COLORS.length]}20`, color: FEATURE_COLORS[i % FEATURE_COLORS.length] }}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{FEATURE_LABELS[f.feature] || f.feature}</p>
                      <p className="text-sm font-semibold text-primary">{formatBRL(f.total_cost_usd * rate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{f.total_calls} chamadas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── CSV Export Helper ───────────────────────────────────────
function downloadCSV(data: any[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvRows = [headers.join(',')]
  for (const row of data) {
    csvRows.push(headers.map(h => {
      const val = row[h]
      if (val == null) return ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(','))
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ──────────────────────────────────────────
export default function AIConsumptionDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [period, setPeriod] = useState('week')

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    let start: Date
    switch (period) {
      case 'today': start = startOfDay(now); break
      case 'month': start = subMonths(now, 1); break
      case 'year': start = subYears(now, 1); break
      default: start = subDays(now, 7); break
    }
    return { startDate: start.toISOString(), endDate: now.toISOString() }
  }, [period])

  // Calculate previous period for trends
  const { prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date()
    let periodMs: number
    switch (period) {
      case 'today': periodMs = 86400000; break
      case 'month': periodMs = 30 * 86400000; break
      case 'year': periodMs = 365 * 86400000; break
      default: periodMs = 7 * 86400000; break
    }
    const prevEnd = new Date(new Date(startDate).getTime())
    const prevStart = new Date(prevEnd.getTime() - periodMs)
    return { prevStartDate: prevStart.toISOString(), prevEndDate: prevEnd.toISOString() }
  }, [startDate, period])

  const { data: consumption, isLoading } = useAIConsumption(startDate, endDate)
  const { data: prevConsumption } = useAIConsumption(prevStartDate, prevEndDate)
  const { data: agentData, isLoading: agentsLoading } = useAgentConsumption(startDate, endDate)
  const { data: modelData, isLoading: modelsLoading } = useModelConsumption(startDate, endDate)
  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyStats(startDate, endDate)
  const { data: topConvData, isLoading: topConvLoading } = useTopConversations(startDate, endDate)
  const { data: messagesLog, isLoading: messagesLoading } = useAIMessagesLog(startDate, endDate)
  const { data: featureData, isLoading: featuresLoading } = useFeatureConsumption(startDate, endDate)
  const { rate } = useExchangeRate()

  const hasRealData = consumption && consumption.total_calls > 0

  // Calculate real trends
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const kpis = useMemo(() => {
    const totalCost = (consumption?.total_cost_usd || 0) * rate
    const totalTokens = consumption?.total_tokens || 0
    const totalCalls = consumption?.total_calls || 0
    const avgTime = totalCalls > 0 ? +((consumption?.avg_response_time_ms || 0) / 1000).toFixed(1) : 0

    const prevCost = (prevConsumption?.total_cost_usd || 0) * rate
    const prevTokens = prevConsumption?.total_tokens || 0
    const prevCalls = prevConsumption?.total_calls || 0
    const prevAvgTime = prevCalls > 0 ? +((prevConsumption?.avg_response_time_ms || 0) / 1000).toFixed(1) : 0

    return {
      totalCost, totalTokens, totalCalls, avgTime,
      trends: {
        cost: calcTrend(totalCost, prevCost),
        tokens: calcTrend(totalTokens, prevTokens),
        calls: calcTrend(totalCalls, prevCalls),
        time: calcTrend(avgTime, prevAvgTime),
      },
    }
  }, [consumption, prevConsumption, rate])

  const dailyData = useMemo(() => {
    if (!hasRealData || !consumption.logs.length) return []
    const grouped: Record<string, { cost: number; tokens: number }> = {}
    for (const log of consumption.logs) {
      const day = format(new Date(log.created_at), 'dd/MM')
      if (!grouped[day]) grouped[day] = { cost: 0, tokens: 0 }
      grouped[day].cost += (log.cost_usd || 0) * rate
      grouped[day].tokens += log.total_tokens || 0
    }
    return Object.entries(grouped).map(([date, v]) => ({ date, cost: +v.cost.toFixed(2), tokens: v.tokens }))
  }, [consumption, hasRealData, rate])

  const hasTrends = hasRealData && (prevConsumption?.total_calls || 0) > 0

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">Consumo de IA</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Analytics de uso e custos por agente, modelo e feature</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mês</SelectItem>
                <SelectItem value="year">Último Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => {
              const logs = messagesLog || []
              if (logs.length === 0) return
              downloadCSV(logs.map((m: any) => ({
                data: m.created_at ? format(new Date(m.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
                role: m.role,
                modelo: m.model_used || '',
                prompt_tokens: m.prompt_tokens || 0,
                completion_tokens: m.completion_tokens || 0,
                total_tokens: m.total_tokens || 0,
                custo_usd: m.cost_usd || 0,
                custo_brl: ((m.cost_usd || 0) * rate).toFixed(6),
                agente: m.ai_agents?.name || '',
                operacao: m.intent || 'chat',
              })), `consumo-ia-${format(new Date(), 'yyyy-MM-dd')}.csv`)
            }}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} title="Custo Total" value={kpis.totalCost > 0 && kpis.totalCost < 0.01 ? `R$ ${kpis.totalCost.toFixed(4).replace('.', ',')}` : formatBRL(kpis.totalCost)} trend={hasTrends ? kpis.trends.cost : undefined} loading={isLoading} noData={!hasRealData} />
          <KPICard icon={Zap} title="Total Tokens" value={formatNumber(kpis.totalTokens)} trend={hasTrends ? kpis.trends.tokens : undefined} loading={isLoading} noData={!hasRealData} />
          <KPICard icon={MessageSquare} title="Chamadas API" value={formatNumber(kpis.totalCalls)} trend={hasTrends ? kpis.trends.calls : undefined} loading={isLoading} noData={!hasRealData} />
          <KPICard icon={Clock} title="Tempo Médio" value={`${kpis.avgTime}s`} trend={hasTrends ? kpis.trends.time : undefined} loading={isLoading} noData={!hasRealData} />
        </div>

        {/* Tabs — GMS style with cyan border */}
        <div className="border-b border-border">
          <div className="flex gap-0 overflow-x-auto scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2',
                    activeTab === tab.id
                      ? 'border-b-[#45E5E5] text-[#10293F] dark:text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className={cn('w-4 h-4', activeTab === tab.id && 'text-[#45E5E5]')} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab dailyData={dailyData} loading={isLoading} />}
        {activeTab === 'messages' && <MessagesLogTab data={messagesLog || []} loading={messagesLoading} rate={rate} />}
        {activeTab === 'features' && <FeaturesTab features={featureData || []} loading={featuresLoading} rate={rate} />}
        {activeTab === 'agents' && <AgentsTab agents={agentData || []} loading={agentsLoading} rate={rate} />}
        {activeTab === 'models' && <ModelsTab models={modelData || []} loading={modelsLoading} rate={rate} />}
        {activeTab === 'performance' && <PerformanceTab data={hourlyData || []} loading={hourlyLoading} />}
        {activeTab === 'top' && <TopConversationsTab data={topConvData || []} loading={topConvLoading} rate={rate} />}
      </div>
    </ScrollArea>
  )
}
