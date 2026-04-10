import { Activity, Key, BarChart3, Clock } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useApiKeyStats } from "@/hooks/useApiKeys"

function MetricCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  })
}

function HourlyChart({ data }: { data: { hour: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados nas ultimas 24h</p>
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium mb-4">Requisicoes por hora (ultimas 24h)</h3>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const height = Math.max((d.count / maxCount) * 100, 2)
          const hour = new Date(d.hour).getHours()
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary"
                style={{ height: `${height}%` }}
                title={`${hour}h — ${d.count} req`}
              />
              {i % 3 === 0 && (
                <span className="text-[10px] text-muted-foreground">{hour}h</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ApiMonitor() {
  const { data: stats, isLoading } = useApiKeyStats()

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  if (!stats) {
    return <p className="text-center text-muted-foreground py-12">Erro ao carregar estatisticas</p>
  }

  return (
    <div className="space-y-6">
      {/* Metricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Key} label="Chaves ativas" value={stats.active_keys} sub={`${stats.total_keys} total`} />
        <MetricCard icon={Activity} label="Requests hoje" value={stats.requests_today} />
        <MetricCard icon={BarChart3} label="Requests total" value={stats.total_requests} />
        <MetricCard icon={Clock} label="Atualizado" value={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} sub="Atualiza a cada 1 min" />
      </div>

      {/* Grafico */}
      <HourlyChart data={stats.hourly_usage} />

      {/* Tabela por chave */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>Organizacao</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Requests total</TableHead>
              <TableHead className="text-right">Limite RPM</TableHead>
              <TableHead>Ultimo uso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.keys.map(k => (
              <TableRow key={k.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{k.name}</p>
                    <code className="text-xs text-muted-foreground">{k.key_prefix}</code>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{k.organization_name || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{k.plan}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={k.is_active ? "default" : "secondary"} className="text-xs">
                    {k.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {(k.request_count || 0).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {k.rate_limit_rpm}/min
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(k.last_used_at)}
                </TableCell>
              </TableRow>
            ))}
            {stats.keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma chave criada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
