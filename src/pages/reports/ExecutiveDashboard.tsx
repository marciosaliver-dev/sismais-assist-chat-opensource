import {
  BarChart3, Bot, Clock, DollarSign, Star, TrendingUp,
  Users, Zap, Building2, Shield, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodSelector, usePeriodSelector } from "@/components/layout/PeriodSelector";
import { ReportKPICards, ReportKPI } from "@/components/reports/ReportKPICards";
import { HourlyHeatmap } from "@/components/reports/HourlyHeatmap";
import { AgentComparisonTable } from "@/components/reports/AgentComparisonTable";
import { SLAComplianceCard } from "@/components/reports/SLAComplianceCard";
import { AnomalyAlerts } from "@/components/reports/AnomalyAlerts";
import { DemandForecast } from "@/components/reports/DemandForecast";
import { AIvsHumanComparison } from "@/components/reports/AIvsHumanComparison";
import { ReportsLayout } from "@/components/reports/ReportsLayout";
import { useExecutiveDashboard } from "@/hooks/useExecutiveDashboard";
import { useSLAMetrics, useAnomalyDetection, useDemandForecast } from "@/hooks/useSLAAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(16,41,63,0.1)",
  fontSize: 13,
};

function ChartCard({ title, children, loading, empty }: { title: string; children: React.ReactNode; loading?: boolean; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)] hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] transition-shadow duration-200">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">{title}</h3>
      </div>
      <div className="p-5">
        {loading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : empty ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Sem dados no período
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const { period, setPeriod } = usePeriodSelector("last30");
  const {
    kpis,
    dailyTrend,
    statusDist,
    priorityDist,
    categoryDist,
    hourlyHeatmap,
    agentPerformance,
    topCompanies,
  } = useExecutiveDashboard(period);

  const slaMetrics = useSLAMetrics(period);
  const anomalies = useAnomalyDetection(period);
  const forecast = useDemandForecast(period);

  const kpiData = kpis.data;
  const slaData = slaMetrics.data;

  const kpiCards: ReportKPI[] = [
    { icon: BarChart3, title: "Total Atendimentos", value: kpiData?.totalConversations ?? 0, accent: "cyan" },
    { icon: Bot, title: "Resolucao IA", value: kpiData ? `${kpiData.aiResolutionRate}%` : "--", accent: "navy" },
    { icon: Star, title: "CSAT Medio", value: kpiData?.avgCsat ?? "--", accent: "yellow" },
    { icon: Shield, title: "SLA Conformidade", value: slaData ? `${slaData.complianceRate}%` : "--", accent: slaData && slaData.complianceRate >= 90 ? "success" : slaData && slaData.complianceRate >= 70 ? "yellow" : "error" },
  ];

  const kpiCards2: ReportKPI[] = [
    { icon: Clock, title: "Tempo Resposta", value: kpiData ? formatDuration(kpiData.avgResponseTime) : "--", accent: "purple" },
    { icon: Clock, title: "Tempo Resolucao", value: kpiData ? formatDuration(kpiData.avgResolutionTime) : "--", accent: "cyan" },
    { icon: DollarSign, title: "Custo Total IA", value: kpiData ? formatBRL(kpiData.totalCostBrl) : "--", accent: "navy" },
    { icon: Zap, title: "Automacoes", value: kpiData?.automationsExecuted ?? 0, accent: "success" },
  ];

  return (
    <ReportsLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#10293F] dark:text-foreground font-[Poppins,Inter,system-ui,sans-serif]">
            Dashboard Executivo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visao consolidada de metricas, SLA e performance
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Anomaly Alerts */}
      {(anomalies.data || []).length > 0 && (
        <AnomalyAlerts alerts={anomalies.data} loading={anomalies.isLoading} />
      )}

      {/* KPIs */}
      <ReportKPICards kpis={kpiCards} loading={kpis.isLoading || slaMetrics.isLoading} />
      <ReportKPICards kpis={kpiCards2} loading={kpis.isLoading} />

      {/* Tabs for sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="border-b border-border">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            {[
              { value: "overview", icon: BarChart3, label: "Visao Geral" },
              { value: "sla", icon: Shield, label: "SLA" },
              { value: "agents", icon: Users, label: "IA vs Humano" },
              { value: "forecast", icon: TrendingUp, label: "Previsao" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-b-[#45E5E5] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#10293F] dark:data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 font-medium"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Tendencia Diaria -- IA vs Humano" loading={dailyTrend.isLoading} empty={!(dailyTrend.data || []).length}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyTrend.data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="ai" name="IA" stroke="#45E5E5" fill="#45E5E5" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="human" name="Humano" stroke="#10293F" fill="#10293F" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuicao por Status" loading={statusDist.isLoading} empty={!(statusDist.data || []).length}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDist.data}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {(statusDist.data || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard title="Por Prioridade" loading={priorityDist.isLoading} empty={!(priorityDist.data || []).length}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityDist.data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                    {(priorityDist.data || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por Categoria" loading={categoryDist.isLoading} empty={!(categoryDist.data || []).length}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryDist.data?.slice(0, 8)} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Tickets" fill="#45E5E5" radius={[4, 4, 0, 0]}>
                    {(categoryDist.data?.slice(0, 8) || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color || "#45E5E5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Volume por Hora/Dia" loading={hourlyHeatmap.isLoading} empty={false}>
              <HourlyHeatmap
                data={hourlyHeatmap.data || []}
                loading={hourlyHeatmap.isLoading}
              />
            </ChartCard>
          </div>

          {/* Top 10 Companies */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#45E5E5]" />
              <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Top 10 Empresas por Volume</h3>
            </div>
            <div className="p-4">
              {topCompanies.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : !(topCompanies.data || []).length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no periodo</p>
              ) : (
                <div className="space-y-1">
                  {topCompanies.data!.map((company, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-[#10293F] text-[#45E5E5] text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-[#10293F] dark:text-foreground">{company.name}</span>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border bg-[#E8F9F9] text-[#10293F] border-[rgba(69,229,229,0.4)]">
                        {company.total} tickets
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* SLA Tab */}
        <TabsContent value="sla" className="space-y-6">
          <SLAComplianceCard data={slaMetrics.data} loading={slaMetrics.isLoading} />

          {/* Agent Performance Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Users className="w-4 h-4 text-[#45E5E5]" />
              <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Performance dos Agentes</h3>
            </div>
            <div className="p-5">
              <AgentComparisonTable
                agents={agentPerformance.data || []}
                loading={agentPerformance.isLoading}
              />
            </div>
          </div>
        </TabsContent>

        {/* IA vs Humano Tab */}
        <TabsContent value="agents" className="space-y-6">
          <AIvsHumanComparison data={slaMetrics.data} loading={slaMetrics.isLoading} />
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6">
          <DemandForecast data={forecast.data} loading={forecast.isLoading} />

          {/* Anomaly section for forecast context */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(16,41,63,0.06)]">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FFB800]" />
              <h3 className="text-sm font-semibold text-[#10293F] dark:text-foreground">Alertas e Anomalias</h3>
            </div>
            <div className="p-5">
              <AnomalyAlerts alerts={anomalies.data} loading={anomalies.isLoading} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ReportsLayout>
  );
}
