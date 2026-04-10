import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodValue } from "@/components/layout/PeriodSelector";
import { format, parseISO, differenceInHours, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────

export interface SLAMetrics {
  totalTickets: number;
  withinSLA: number;
  violatedSLA: number;
  complianceRate: number;
  avgFirstResponseSeconds: number;
  avgResolutionSeconds: number;
  byPriority: {
    priority: string;
    total: number;
    withinSLA: number;
    complianceRate: number;
    avgResolutionSeconds: number;
  }[];
  byAgent: {
    agentId: string;
    agentName: string;
    agentType: "ia" | "humano";
    total: number;
    withinSLA: number;
    complianceRate: number;
    avgResponseSeconds: number;
    avgResolutionSeconds: number;
    avgCsat: number;
    totalCostUsd: number;
  }[];
}

export interface AnomalyAlert {
  id: string;
  type: "volume_spike" | "high_latency" | "low_csat" | "error_rate" | "sla_violation";
  severity: "warning" | "critical";
  title: string;
  description: string;
  value: number;
  threshold: number;
  detectedAt: string;
}

export interface DemandForecastPoint {
  date: string;
  actual: number;
  forecast: number | null;
}

// ─── SLA Thresholds (default, could be configurable) ────────

const SLA_THRESHOLDS: Record<string, { firstResponse: number; resolution: number }> = {
  critica: { firstResponse: 900, resolution: 7200 },      // 15min / 2h
  alta: { firstResponse: 1800, resolution: 14400 },        // 30min / 4h
  media: { firstResponse: 3600, resolution: 28800 },       // 1h / 8h
  baixa: { firstResponse: 7200, resolution: 86400 },       // 2h / 24h
  default: { firstResponse: 3600, resolution: 28800 },     // 1h / 8h
};

function getSLAThreshold(priority: string | null) {
  return SLA_THRESHOLDS[priority || "default"] || SLA_THRESHOLDS.default;
}

// ─── Hook: SLA Metrics ─────────────────────────────────────

export function useSLAMetrics(period: PeriodValue) {
  const fromISO = period.from.toISOString();
  const toISO = period.to.toISOString();

  return useQuery({
    queryKey: ["sla-metrics", fromISO, toISO],
    queryFn: async (): Promise<SLAMetrics> => {
      // Fetch conversations with timing data
      const { data: convs } = await supabase
        .from("ai_conversations")
        .select(
          "id, priority, status, started_at, resolved_at, first_human_response_seconds, resolution_seconds, csat_score, ai_resolved, handler_type, current_agent_id, human_agent_id, ai_agents!ai_conversations_current_agent_id_fkey(id, name), human_agents(id, name)"
        )
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      // Fetch cost data per agent
      const { data: costs } = await supabase
        .from("ai_messages")
        .select("agent_id, cost_usd")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .not("cost_usd", "is", null)
        .not("agent_id", "is", null);

      const costByAgent: Record<string, number> = {};
      for (const c of costs || []) {
        costByAgent[c.agent_id!] = (costByAgent[c.agent_id!] || 0) + (c.cost_usd || 0);
      }

      const items = convs || [];
      const resolved = items.filter(
        (c) => c.status === "finalizado" || c.status === "resolvido"
      );

      let withinSLA = 0;
      let violatedSLA = 0;

      // Calculate SLA compliance
      for (const c of resolved) {
        const threshold = getSLAThreshold(c.priority);
        const resolutionTime =
          c.resolved_at && c.started_at
            ? (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
            : c.resolution_seconds || 0;

        if (resolutionTime > 0 && resolutionTime <= threshold.resolution) {
          withinSLA++;
        } else if (resolutionTime > threshold.resolution) {
          violatedSLA++;
        }
      }

      // Avg first response
      const respItems = items.filter(
        (c) => c.first_human_response_seconds && c.first_human_response_seconds > 0
      );
      const avgFirstResponse = respItems.length
        ? Math.round(
            respItems.reduce((s, c) => s + (c.first_human_response_seconds || 0), 0) /
              respItems.length
          )
        : 0;

      // Avg resolution
      const resItems = resolved.filter((c) => c.resolved_at && c.started_at);
      const avgResolution = resItems.length
        ? Math.round(
            resItems.reduce((s, c) => {
              const start = new Date(c.started_at!).getTime();
              const end = new Date(c.resolved_at!).getTime();
              return s + (end - start) / 1000;
            }, 0) / resItems.length
          )
        : 0;

      // By priority
      const priorityMap = new Map<
        string,
        { total: number; withinSLA: number; resSum: number; resCount: number }
      >();
      for (const c of items) {
        const p = c.priority || "media";
        if (!priorityMap.has(p))
          priorityMap.set(p, { total: 0, withinSLA: 0, resSum: 0, resCount: 0 });
        const e = priorityMap.get(p)!;
        e.total++;

        if (c.status === "finalizado" || c.status === "resolvido") {
          const threshold = getSLAThreshold(p);
          const resTime =
            c.resolved_at && c.started_at
              ? (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
              : 0;
          if (resTime > 0) {
            e.resSum += resTime;
            e.resCount++;
            if (resTime <= threshold.resolution) e.withinSLA++;
          }
        }
      }

      const byPriority = Array.from(priorityMap.entries()).map(([priority, v]) => ({
        priority,
        total: v.total,
        withinSLA: v.withinSLA,
        complianceRate: v.resCount > 0 ? Math.round((v.withinSLA / v.resCount) * 100) : 0,
        avgResolutionSeconds: v.resCount > 0 ? Math.round(v.resSum / v.resCount) : 0,
      }));

      // By agent (IA + Human combined)
      const agentMap = new Map<
        string,
        {
          name: string;
          type: "ia" | "humano";
          total: number;
          withinSLA: number;
          resCount: number;
          respSum: number;
          respCount: number;
          resSum: number;
          csatSum: number;
          csatCount: number;
        }
      >();

      for (const c of items) {
        // AI agent
        const aiAgent = c.ai_agents as Record<string, unknown> | null;
        if (aiAgent && c.current_agent_id) {
          const id = `ia-${c.current_agent_id}`;
          if (!agentMap.has(id))
            agentMap.set(id, {
              name: aiAgent.name as string,
              type: "ia",
              total: 0,
              withinSLA: 0,
              resCount: 0,
              respSum: 0,
              respCount: 0,
              resSum: 0,
              csatSum: 0,
              csatCount: 0,
            });
          const e = agentMap.get(id)!;
          e.total++;

          if (c.status === "finalizado" || c.status === "resolvido") {
            const threshold = getSLAThreshold(c.priority);
            const resTime =
              c.resolved_at && c.started_at
                ? (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
                : 0;
            if (resTime > 0) {
              e.resSum += resTime;
              e.resCount++;
              if (resTime <= threshold.resolution) e.withinSLA++;
            }
          }
          if (c.csat_score) {
            e.csatSum += c.csat_score;
            e.csatCount++;
          }
        }

        // Human agent
        const humanAgent = c.human_agents as Record<string, unknown> | null;
        if (humanAgent && c.human_agent_id) {
          const id = `humano-${c.human_agent_id}`;
          if (!agentMap.has(id))
            agentMap.set(id, {
              name: humanAgent.name as string,
              type: "humano",
              total: 0,
              withinSLA: 0,
              resCount: 0,
              respSum: 0,
              respCount: 0,
              resSum: 0,
              csatSum: 0,
              csatCount: 0,
            });
          const e = agentMap.get(id)!;
          e.total++;

          if (c.first_human_response_seconds && c.first_human_response_seconds > 0) {
            e.respSum += c.first_human_response_seconds;
            e.respCount++;
          }

          if (c.status === "finalizado" || c.status === "resolvido") {
            const threshold = getSLAThreshold(c.priority);
            const resTime =
              c.resolved_at && c.started_at
                ? (new Date(c.resolved_at).getTime() - new Date(c.started_at).getTime()) / 1000
                : 0;
            if (resTime > 0) {
              e.resSum += resTime;
              e.resCount++;
              if (resTime <= threshold.resolution) e.withinSLA++;
            }
          }
          if (c.csat_score) {
            e.csatSum += c.csat_score;
            e.csatCount++;
          }
        }
      }

      const byAgent = Array.from(agentMap.entries()).map(([key, v]) => {
        const rawId = key.replace(/^(ia|humano)-/, "");
        return {
          agentId: rawId,
          agentName: v.name,
          agentType: v.type,
          total: v.total,
          withinSLA: v.withinSLA,
          complianceRate: v.resCount > 0 ? Math.round((v.withinSLA / v.resCount) * 100) : 0,
          avgResponseSeconds: v.respCount > 0 ? Math.round(v.respSum / v.respCount) : 0,
          avgResolutionSeconds: v.resCount > 0 ? Math.round(v.resSum / v.resCount) : 0,
          avgCsat: v.csatCount > 0 ? Number((v.csatSum / v.csatCount).toFixed(1)) : 0,
          totalCostUsd: v.type === "ia" ? costByAgent[rawId] || 0 : 0,
        };
      }).sort((a, b) => b.total - a.total);

      return {
        totalTickets: items.length,
        withinSLA,
        violatedSLA,
        complianceRate:
          withinSLA + violatedSLA > 0
            ? Math.round((withinSLA / (withinSLA + violatedSLA)) * 100)
            : 0,
        avgFirstResponseSeconds: avgFirstResponse,
        avgResolutionSeconds: avgResolution,
        byPriority,
        byAgent,
      };
    },
  });
}

// ─── Hook: Anomaly Detection ────────────────────────────────

export function useAnomalyDetection(period: PeriodValue) {
  const fromISO = period.from.toISOString();
  const toISO = period.to.toISOString();

  return useQuery({
    queryKey: ["anomaly-detection", fromISO, toISO],
    queryFn: async (): Promise<AnomalyAlert[]> => {
      const alerts: AnomalyAlert[] = [];

      // Fetch daily volumes for anomaly detection
      const { data: convs } = await supabase
        .from("ai_conversations")
        .select("started_at, status, csat_score, priority, resolved_at, first_human_response_seconds")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const items = convs || [];
      if (items.length === 0) return alerts;

      // Group by day
      const byDay = new Map<string, typeof items>();
      for (const c of items) {
        if (!c.started_at) continue;
        const d = format(parseISO(c.started_at), "yyyy-MM-dd");
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d)!.push(c);
      }

      const dailyVolumes = Array.from(byDay.values()).map((v) => v.length);
      const avgVolume = dailyVolumes.length
        ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length
        : 0;
      const stdDev = dailyVolumes.length > 1
        ? Math.sqrt(
            dailyVolumes.reduce((s, v) => s + Math.pow(v - avgVolume, 2), 0) /
              (dailyVolumes.length - 1)
          )
        : 0;

      // Check latest day for volume spike
      const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a));
      if (sortedDays.length > 0) {
        const [latestDay, latestItems] = sortedDays[0];
        const threshold = avgVolume + 2 * stdDev;
        if (latestItems.length > threshold && threshold > 0) {
          alerts.push({
            id: `vol-${latestDay}`,
            type: "volume_spike",
            severity: latestItems.length > avgVolume + 3 * stdDev ? "critical" : "warning",
            title: "Pico de volume detectado",
            description: `${latestItems.length} atendimentos em ${format(parseISO(latestDay), "dd/MM", { locale: ptBR })} (media: ${Math.round(avgVolume)})`,
            value: latestItems.length,
            threshold: Math.round(threshold),
            detectedAt: latestDay,
          });
        }
      }

      // SLA violations check
      const resolved = items.filter(
        (c) =>
          (c.status === "finalizado" || c.status === "resolvido") &&
          c.resolved_at &&
          c.started_at
      );
      const violated = resolved.filter((c) => {
        const resTime =
          (new Date(c.resolved_at!).getTime() - new Date(c.started_at!).getTime()) / 1000;
        const threshold = getSLAThreshold(c.priority);
        return resTime > threshold.resolution;
      });
      const violationRate = resolved.length > 0 ? (violated.length / resolved.length) * 100 : 0;

      if (violationRate > 20) {
        alerts.push({
          id: "sla-violation-rate",
          type: "sla_violation",
          severity: violationRate > 40 ? "critical" : "warning",
          title: "Alta taxa de violacao de SLA",
          description: `${Math.round(violationRate)}% dos tickets resolvidos violaram o SLA (${violated.length} de ${resolved.length})`,
          value: Math.round(violationRate),
          threshold: 20,
          detectedAt: new Date().toISOString(),
        });
      }

      // Low CSAT check
      const withCsat = items.filter((c) => c.csat_score != null && c.csat_score > 0);
      if (withCsat.length >= 5) {
        const avgCsat =
          withCsat.reduce((s, c) => s + (c.csat_score || 0), 0) / withCsat.length;
        if (avgCsat < 3.5) {
          alerts.push({
            id: "low-csat",
            type: "low_csat",
            severity: avgCsat < 3.0 ? "critical" : "warning",
            title: "CSAT abaixo do esperado",
            description: `CSAT medio de ${avgCsat.toFixed(1)} no periodo (minimo recomendado: 3.5)`,
            value: Number(avgCsat.toFixed(1)),
            threshold: 3.5,
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // High first response time
      const respItems = items.filter(
        (c) => c.first_human_response_seconds && c.first_human_response_seconds > 0
      );
      if (respItems.length > 0) {
        const avgResp =
          respItems.reduce((s, c) => s + (c.first_human_response_seconds || 0), 0) /
          respItems.length;
        if (avgResp > 3600) {
          alerts.push({
            id: "high-latency",
            type: "high_latency",
            severity: avgResp > 7200 ? "critical" : "warning",
            title: "Tempo de resposta elevado",
            description: `Tempo medio de primeira resposta: ${Math.round(avgResp / 60)}min (limite: 60min)`,
            value: Math.round(avgResp),
            threshold: 3600,
            detectedAt: new Date().toISOString(),
          });
        }
      }

      // Check pipeline_metrics for error rate if available
      try {
        const { data: metrics } = await (supabase
          .from("pipeline_metrics" as any) as any)
          .select("success, event_type")
          .gte("created_at", fromISO)
          .lte("created_at", toISO);

        if (metrics && metrics.length > 0) {
          const total = metrics.length;
          const errors = metrics.filter((m: any) => m.success === false).length;
          const errorRate = (errors / total) * 100;
          if (errorRate > 5) {
            alerts.push({
              id: "error-rate",
              type: "error_rate",
              severity: errorRate > 10 ? "critical" : "warning",
              title: "Taxa de erro elevada no pipeline",
              description: `${errorRate.toFixed(1)}% de erros no pipeline (${errors} de ${total} eventos)`,
              value: Number(errorRate.toFixed(1)),
              threshold: 5,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      } catch {
        // pipeline_metrics table may not exist yet
      }

      return alerts.sort((a, b) => {
        const sevOrder = { critical: 0, warning: 1 };
        return sevOrder[a.severity] - sevOrder[b.severity];
      });
    },
  });
}

// ─── Hook: Demand Forecast (simple linear trend) ────────────

export function useDemandForecast(period: PeriodValue) {
  const fromISO = period.from.toISOString();
  const toISO = period.to.toISOString();

  return useQuery({
    queryKey: ["demand-forecast", fromISO, toISO],
    queryFn: async (): Promise<DemandForecastPoint[]> => {
      const { data: convs } = await supabase
        .from("ai_conversations")
        .select("started_at")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const items = convs || [];

      // Group by day
      const byDay = new Map<string, number>();
      for (const c of items) {
        if (!c.started_at) continue;
        const d = format(parseISO(c.started_at), "yyyy-MM-dd");
        byDay.set(d, (byDay.get(d) || 0) + 1);
      }

      const sorted = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
      if (sorted.length < 3) {
        return sorted.map(([date, count]) => ({
          date: format(parseISO(date), "dd/MM", { locale: ptBR }),
          actual: count,
          forecast: null,
        }));
      }

      // Simple linear regression for forecast
      const n = sorted.length;
      const xs = sorted.map((_, i) => i);
      const ys = sorted.map(([, v]) => v);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sumX2 = xs.reduce((a, x) => a + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Actual points
      const result: DemandForecastPoint[] = sorted.map(([date, count]) => ({
        date: format(parseISO(date), "dd/MM", { locale: ptBR }),
        actual: count,
        forecast: null,
      }));

      // Add 7 days of forecast
      const lastDate = parseISO(sorted[sorted.length - 1][0]);
      for (let i = 1; i <= 7; i++) {
        const forecastDate = addDays(lastDate, i);
        const forecastValue = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
        result.push({
          date: format(forecastDate, "dd/MM", { locale: ptBR }),
          actual: 0,
          forecast: forecastValue,
        });
      }

      return result;
    },
  });
}
