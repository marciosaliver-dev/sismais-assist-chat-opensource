import { useState, useMemo } from 'react'
import { useCSATSurveys } from '@/hooks/useCSATSurveys'
import { useKanbanBoards } from '@/hooks/useKanbanBoards'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, TrendingUp, Send, SmilePlus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-gray-100 text-gray-700',
  negative: 'bg-red-100 text-red-700',
  mixed: 'bg-yellow-100 text-yellow-700',
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positivo',
  neutral: 'Neutro',
  negative: 'Negativo',
  mixed: 'Misto',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviada',
  resent: 'Reenviada',
  processing: 'Processando',
  answered: 'Respondida',
  expired: 'Expirada',
}

function StarScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-sm">--</span>
  return (
    <span className="flex items-center gap-1 font-semibold text-[#10293F]">
      <Star className="h-3.5 w-3.5 text-[#FFB800] fill-[#FFB800]" />
      {score}
    </span>
  )
}

export function CSATDashboardTab() {
  const [boardFilter, setBoardFilter] = useState<string>('all')

  const { data: boards } = useKanbanBoards()
  const { surveys, metrics, isLoading } = useCSATSurveys(
    boardFilter !== 'all' ? { boardId: boardFilter } : undefined
  )

  // Sentimento predominante
  const dominantSentiment = useMemo(() => {
    const breakdown = metrics.sentimentBreakdown
    const entries = Object.entries(breakdown)
    if (entries.length === 0) return null
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  }, [metrics.sentimentBreakdown])

  const kpis = [
    {
      icon: Star,
      label: 'Score médio',
      value: metrics.avgScore > 0 ? `${metrics.avgScore}/5` : '--',
      iconBg: 'bg-[#E8F9F9]',
      iconColor: 'text-[#10293F]',
    },
    {
      icon: TrendingUp,
      label: 'Taxa de resposta',
      value: metrics.totalSent > 0 ? `${metrics.responseRate}%` : '--',
      iconBg: 'bg-[#F0FDF4]',
      iconColor: 'text-[#16A34A]',
    },
    {
      icon: Send,
      label: 'Pesquisas enviadas',
      value: metrics.totalSent,
      iconBg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#2563EB]',
    },
    {
      icon: SmilePlus,
      label: 'Sentimento predominante',
      value: dominantSentiment ? (SENTIMENT_LABELS[dominantSentiment] ?? dominantSentiment) : '--',
      iconBg: 'bg-[#FFFBEB]',
      iconColor: 'text-[#92400E]',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={boardFilter} onValueChange={setBoardFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Board" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os boards</SelectItem>
            {(boards ?? []).map((b: any) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border overflow-hidden">
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.iconBg}`}>
                  <Icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium truncate">{kpi.label}</p>
                  <p className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif] mt-0.5 leading-tight">
                    {kpi.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Table */}
      {surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Send className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Nenhuma pesquisa CSAT encontrada</p>
          <p className="text-sm mt-1">As pesquisas aparecerão aqui quando forem enviadas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Conversa</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Cliente</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Board</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Score</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Sentimento</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-white/80 text-xs font-semibold uppercase tracking-wide">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => {
                const sentiment = survey.ai_analysis?.sentiment
                const status = survey.status
                return (
                  <TableRow key={survey.id} className="border-b border-[#F0F0F0]">
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {survey.conversation?.ticket_number
                        ? `#${survey.conversation.ticket_number}`
                        : '--'}
                    </TableCell>
                    <TableCell className="text-sm text-[#333]">
                      {survey.conversation?.customer_name ?? survey.customer_phone ?? '--'}
                    </TableCell>
                    <TableCell className="text-sm text-[#333]">
                      {survey.config?.board?.name ?? '--'}
                    </TableCell>
                    <TableCell>
                      <StarScore score={survey.score} />
                    </TableCell>
                    <TableCell>
                      {sentiment ? (
                        <Badge
                          className={`text-[10px] font-semibold border-0 ${SENTIMENT_COLORS[sentiment] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {SENTIMENT_LABELS[sentiment] ?? sentiment}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {STATUS_LABELS[status] ?? status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {survey.created_at
                        ? format(new Date(survey.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                        : '--'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
