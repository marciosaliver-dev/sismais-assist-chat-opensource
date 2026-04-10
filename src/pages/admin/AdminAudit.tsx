import { useState } from "react"
import { Shield, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { useAuditLogs, useAuditMetrics } from "@/hooks/useAuditLogs"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  responded: { label: "Respondeu", variant: "default" },
  escalated: { label: "Escalou", variant: "destructive" },
  flagged_for_review: { label: "Revisão", variant: "secondary" },
  blocked: { label: "Bloqueou", variant: "destructive" },
}

export default function AdminAudit() {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<{
    agentId?: string
    actionTaken?: string
    dateFrom?: string
    dateTo?: string
  }>({})

  const { data: metrics, isLoading: metricsLoading } = useAuditMetrics()
  const { data: logs, isLoading: logsLoading } = useAuditLogs(filters, page)

  // Fetch agents for filter dropdown
  const { data: agents } = useQuery({
    queryKey: ["agents-list-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents").select("id, name").order("name")
      return data || []
    },
  })

  const totalPages = logs ? Math.ceil(logs.total / 50) : 0

  return (
    <div className="page-container"><div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Auditoria IA</h1>
          <p className="text-sm text-muted-foreground">Monitoramento de confiança, guardrails e ações dos agentes</p>
        </div>
      </div>

      {/* Metrics */}
      {metricsLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Interações hoje" value={metrics.total} icon={Activity} color="bg-primary/10 text-primary" />
          <MetricCard label="Confiança alta" value={metrics.green} icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-600" />
          <MetricCard label="Revisão" value={metrics.yellow} icon={AlertTriangle} color="bg-amber-500/10 text-amber-600" />
          <MetricCard label="Baixa confiança" value={metrics.red} icon={XCircle} color="bg-red-500/10 text-red-600" />
          <MetricCard label="Escalações" value={metrics.escalated} icon={AlertTriangle} color="bg-violet-500/10 text-violet-600" />
        </div>
      )}

      {/* Top guardrails */}
      {metrics && metrics.topGuardrails.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-2">Guardrails mais acionados hoje</h3>
          <div className="flex flex-wrap gap-2">
            {metrics.topGuardrails.map(([name, count]) => (
              <Badge key={name} variant="outline" className="text-xs">
                {name} ({count}x)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filters.agentId || "all"} onValueChange={v => setFilters(f => ({ ...f, agentId: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agents?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.actionTaken || "all"} onValueChange={v => setFilters(f => ({ ...f, actionTaken: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="responded">Respondeu</SelectItem>
            <SelectItem value="escalated">Escalou</SelectItem>
            <SelectItem value="flagged_for_review">Revisão</SelectItem>
            <SelectItem value="blocked">Bloqueou</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.dateFrom || ""}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
          className="w-40"
          placeholder="De"
        />
        <Input
          type="date"
          value={filters.dateTo || ""}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
          className="w-40"
          placeholder="Até"
        />
      </div>

      {/* Table */}
      {logsLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Guardrails</TableHead>
                <TableHead>Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              )}
              {logs?.data.map((log: any) => {
                const conf = log.confidence_score ? Math.round(Number(log.confidence_score) * 100) : null
                const confColor = conf == null ? "" : conf >= 70 ? "text-emerald-600" : conf >= 50 ? "text-amber-600" : "text-red-600"
                const action = ACTION_LABELS[log.action_taken] || { label: log.action_taken, variant: "outline" as const }
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm">{log.ai_agents?.name || "-"}</TableCell>
                    <TableCell className="text-sm">{log.ai_conversations?.contact_name || log.ai_conversations?.contact_phone || "-"}</TableCell>
                    <TableCell>
                      {conf != null && (
                        <span className={cn("text-sm font-medium", confColor)} title={log.confidence_reason || ""}>
                          {conf}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={action.variant} className="text-xs">{action.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.guardrails_triggered?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(log.guardrails_triggered as string[]).slice(0, 2).map((g: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{g}</Badge>
                          ))}
                          {log.guardrails_triggered.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{log.guardrails_triggered.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.response_time_ms ? `${(log.response_time_ms / 1000).toFixed(1)}s` : "-"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{logs?.total || 0} registros</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm flex items-center px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div></div>
  )
}
