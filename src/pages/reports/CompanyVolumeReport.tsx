import { Building2, Users, FileSearch, TrendingUp, Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { PeriodSelector, usePeriodSelector } from "@/components/layout/PeriodSelector";
import { ReportKPICards, ReportKPI } from "@/components/reports/ReportKPICards";
import { ReportsLayout } from "@/components/reports/ReportsLayout";
import { useCompanyVolumeReport } from "@/hooks/useCompanyVolumeReport";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = ["#45E5E5", "#10293F", "#FFB800", "#7C3AED", "#16A34A"];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,41,63,0.1)",
  fontSize: 13,
};

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

export default function CompanyVolumeReport() {
  const navigate = useNavigate();
  const { period, setPeriod } = usePeriodSelector("last30");
  const { data, isLoading } = useCompanyVolumeReport(period);

  const kpiCards: ReportKPI[] = [
    { icon: Building2, title: "Empresas Atendidas", value: data?.kpis.totalCompanies ?? 0, accent: "navy" },
    { icon: FileSearch, title: "Total de Tickets", value: data?.kpis.totalTickets ?? 0, accent: "cyan" },
    { icon: TrendingUp, title: "Média por Empresa", value: data?.kpis.avgPerCompany ?? 0, accent: "yellow" },
  ];

  const top15 = (data?.companies || []).slice(0, 15).map((c) => ({
    name: c.companyName.length > 20 ? c.companyName.slice(0, 18) + "…" : c.companyName,
    fullName: c.companyName,
    tickets: c.total,
  }));

  const top5Names = (data?.companies || []).slice(0, 5).map((c) => c.companyName);

  return (
    <ReportsLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
            Volume por Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de volume de atendimentos por empresa/cliente
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* KPIs */}
      <ReportKPICards kpis={kpiCards} loading={isLoading} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Top 15 */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)] hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] transition-shadow duration-200">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Top 15 Empresas por Volume</h3>
          </div>
          <div className="p-5">
            {isLoading ? (
              <Skeleton className="h-[350px] w-full rounded-lg" />
            ) : !top15.length ? (
              <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={top15} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value} tickets`, "Volume"]}
                    labelFormatter={(label: string) => {
                      const item = top15.find((t) => t.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="tickets" fill="#45E5E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Area Chart */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)] hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] transition-shadow duration-200">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Tendência Diária — Top 5</h3>
          </div>
          <div className="p-5">
            {isLoading ? (
              <Skeleton className="h-[350px] w-full rounded-lg" />
            ) : !(data?.dailyTrends || []).length ? (
              <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={data!.dailyTrends} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d: string) => {
                      const [, m, day] = d.split("-");
                      return `${day}/${m}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {top5Names.map((name, i) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={CHART_COLORS[i]}
                      fill={CHART_COLORS[i]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-[#45E5E5]" />
          <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Detalhamento por Empresa</h3>
        </div>
        <div className="overflow-x-auto">
          <Table className="stagger-rows">
            <TableHeader>
              <TableRow className="bg-[#10293F] hover:bg-[#10293F]">
                <TableHead className="text-white/80 text-[11px] uppercase tracking-wider font-semibold">Empresa</TableHead>
                <TableHead className="text-right w-20 text-white/80 text-[11px] uppercase tracking-wider font-semibold">Total</TableHead>
                <TableHead className="text-right w-20 text-white/80 text-[11px] uppercase tracking-wider font-semibold">IA %</TableHead>
                <TableHead className="text-right w-28 text-white/80 text-[11px] uppercase tracking-wider font-semibold">Tempo Médio</TableHead>
                <TableHead className="text-right w-20 text-white/80 text-[11px] uppercase tracking-wider font-semibold">CSAT</TableHead>
                <TableHead className="w-48 text-white/80 text-[11px] uppercase tracking-wider font-semibold">Prioridades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !(data?.companies || []).length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhuma empresa encontrada no período
                  </TableCell>
                </TableRow>
              ) : (
                data!.companies.map((company) => (
                  <TableRow
                    key={company.clientId}
                    className="cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-muted/50 transition-colors border-b border-border/50"
                    onClick={() => navigate(`/reports/tickets?client=${company.clientId}`)}
                  >
                    <TableCell className="font-medium text-[13px]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#10293F] text-[#45E5E5] text-[10px] font-bold flex items-center justify-center shrink-0">
                          {company.companyName.charAt(0)}
                        </div>
                        <span className="text-[#10293F] dark:text-foreground">{company.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-[#10293F] dark:text-foreground">{company.total}</TableCell>
                    <TableCell className="text-right">
                      <span className={company.aiResolvedPct >= 50 ? "text-[#45E5E5] font-semibold" : "text-muted-foreground"}>
                        {company.aiResolvedPct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-muted-foreground">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(company.avgResolutionSeconds)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {company.avgCsat > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          <Star className="w-3.5 h-3.5 text-[#FFB800] fill-[#FFB800]" />
                          <span className="font-medium">{company.avgCsat}</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        {company.priorityBreakdown.critica > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-purple-50 text-[#7C3AED] border-purple-200">
                            {company.priorityBreakdown.critica} crítica
                          </span>
                        )}
                        {company.priorityBreakdown.alta > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-[#FEF2F2] text-[#DC2626] border-red-200">
                            {company.priorityBreakdown.alta} alta
                          </span>
                        )}
                        {company.priorityBreakdown.media > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-[#FFFBEB] text-[#92400E] border-yellow-200">
                            {company.priorityBreakdown.media} média
                          </span>
                        )}
                        {company.priorityBreakdown.baixa > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-[#F0FDF4] text-[#16A34A] border-green-200">
                            {company.priorityBreakdown.baixa} baixa
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReportsLayout>
  );
}
