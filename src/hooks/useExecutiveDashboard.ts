import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodValue } from "@/components/layout/PeriodSelector";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExecutiveKPIs {
  totalConversations: number;
  aiResolutionRate: number;
  avgCsat: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  escalationRate: number;
  totalCostBrl: number;
  automationsExecuted: number;
}

export interface DailyTrendPoint {
  date: string;
  ai: number;
  human: number;
  total: number;
}

export interface DistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface HourlyCell {
  day: number;
  hour: number;
  count: number;
}

export interface AgentPerformance {
  id: string;
  name: string;
  type: "ia" | "humano";
  conversations: number;
  successRate: number;
  avgCsat: number;
  avgResolutionSeconds: number;
  costBrl: number;
}

export interface TopCompany {
  name: string;
  total: number;
}

export function useExecutiveDashboard(period: PeriodValue) {
  const fromISO = period.from.toISOString();
  const toISO = period.to.toISOString();

  // Main KPIs
  const kpis = useQuery({
    queryKey: ["exec-kpis", fromISO, toISO],
    queryFn: async (): Promise<ExecutiveKPIs> => {
      const { data: convs } = await supabase
        .from("ai_conversations")
        .select("ai_resolved, resolution_seconds, first_human_response_seconds, csat_score, agent_switches_count, handler_type, status, started_at, resolved_at")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const { data: costs } = await supabase
        .from("ai_messages")
        .select("cost_usd")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .not("cost_usd", "is", null);

      const { data: autoLogs } = await supabase
        .from("ai_automation_logs")
        .select("id")
        .gte("executed_at", fromISO)
        .lte("executed_at", toISO);

      const items = convs || [];
      const total = items.length;
      const aiResolved = items.filter((i) => i.ai_resolved).length;
      const escalated = items.filter((i) => (i.agent_switches_count || 0) > 0).length;

      const csatItems = items.filter((i) => i.csat_score != null);
      const avgCsat = csatItems.length ? csatItems.reduce((s, i) => s + (i.csat_score || 0), 0) / csatItems.length : 0;

      const respItems = items.filter((i) => i.first_human_response_seconds != null && i.first_human_response_seconds > 0);
      const avgResponse = respItems.length ? respItems.reduce((s, i) => s + (i.first_human_response_seconds || 0), 0) / respItems.length : 0;

      // TMA: abertura→conclusão dos tickets finalizados
      const resItems = items.filter((i) => i.status === 'finalizado' && i.resolved_at && i.started_at);
      const avgResolution = resItems.length ? resItems.reduce((s, i) => {
        const start = new Date(i.started_at!).getTime();
        const end = new Date(i.resolved_at!).getTime();
        return s + (end - start) / 1000;
      }, 0) / resItems.length : 0;

      const totalCostUsd = (costs || []).reduce((s, i) => s + (i.cost_usd || 0), 0);
      const totalCostBrl = totalCostUsd * 5.5; // approximate rate

      return {
        totalConversations: total,
        aiResolutionRate: total > 0 ? Math.round((aiResolved / total) * 100) : 0,
        avgCsat: Number(avgCsat.toFixed(1)),
        avgResponseTime: Math.round(avgResponse),
        avgResolutionTime: Math.round(avgResolution),
        escalationRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
        totalCostBrl: Number(totalCostBrl.toFixed(2)),
        automationsExecuted: (autoLogs || []).length,
      };
    },
  });

  // Daily trend
  const dailyTrend = useQuery({
    queryKey: ["exec-daily-trend", fromISO, toISO],
    queryFn: async (): Promise<DailyTrendPoint[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("started_at, handler_type")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const byDate = new Map<string, { ai: number; human: number }>();
      for (const conv of data || []) {
        if (!conv.started_at) continue;
        const d = format(parseISO(conv.started_at), "yyyy-MM-dd");
        if (!byDate.has(d)) byDate.set(d, { ai: 0, human: 0 });
        const entry = byDate.get(d)!;
        if (conv.handler_type === "ai") entry.ai++;
        else entry.human++;
      }

      return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: format(parseISO(date), "dd/MM", { locale: ptBR }),
          ai: vals.ai,
          human: vals.human,
          total: vals.ai + vals.human,
        }));
    },
  });

  // Status distribution
  const statusDist = useQuery({
    queryKey: ["exec-status-dist", fromISO, toISO],
    queryFn: async (): Promise<DistributionItem[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("status")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const map = new Map<string, number>();
      for (const c of data || []) {
        const s = c.status || "desconhecido";
        map.set(s, (map.get(s) || 0) + 1);
      }

      const colorMap: Record<string, string> = {
        aberto: "#45E5E5",
        em_atendimento: "#2563EB",
        aguardando: "#FFB800",
        finalizado: "#16A34A",
        resolvido: "#16A34A",
        cancelado: "#666666",
      };

      return Array.from(map.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
        value,
        color: colorMap[name] || "#999",
      }));
    },
  });

  // Priority distribution
  const priorityDist = useQuery({
    queryKey: ["exec-priority-dist", fromISO, toISO],
    queryFn: async (): Promise<DistributionItem[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("priority")
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .not("priority", "is", null);

      const map = new Map<string, number>();
      for (const c of data || []) {
        const p = c.priority || "sem";
        map.set(p, (map.get(p) || 0) + 1);
      }

      const colorMap: Record<string, string> = {
        critica: "#7C3AED",
        alta: "#DC2626",
        media: "#FFB800",
        baixa: "#16A34A",
      };

      return Array.from(map.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: colorMap[name] || "#999",
      }));
    },
  });

  // Category distribution
  const categoryDist = useQuery({
    queryKey: ["exec-category-dist", fromISO, toISO],
    queryFn: async (): Promise<DistributionItem[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("ticket_category_id, ticket_categories(name, color)")
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .not("ticket_category_id", "is", null);

      const map = new Map<string, { count: number; color?: string }>();
      for (const c of data || []) {
        const cat = c.ticket_categories as Record<string, unknown> | null;
        const name = (cat?.name as string) || "Sem categoria";
        const color = cat?.color as string | undefined;
        if (!map.has(name)) map.set(name, { count: 0, color });
        map.get(name)!.count++;
      }

      return Array.from(map.entries())
        .map(([name, { count, color }]) => ({ name, value: count, color }))
        .sort((a, b) => b.value - a.value);
    },
  });

  // Hourly heatmap
  const hourlyHeatmap = useQuery({
    queryKey: ["exec-hourly-heatmap", fromISO, toISO],
    queryFn: async (): Promise<HourlyCell[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("started_at")
        .gte("started_at", fromISO)
        .lte("started_at", toISO);

      const cells = new Map<string, number>();
      for (const c of data || []) {
        if (!c.started_at) continue;
        const date = parseISO(c.started_at);
        const day = date.getDay(); // 0=Sun
        const hour = date.getHours();
        const key = `${day}-${hour}`;
        cells.set(key, (cells.get(key) || 0) + 1);
      }

      const result: HourlyCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          result.push({ day, hour, count: cells.get(`${day}-${hour}`) || 0 });
        }
      }
      return result;
    },
  });

  // Agent performance
  const agentPerformance = useQuery({
    queryKey: ["exec-agent-performance", fromISO, toISO],
    queryFn: async (): Promise<AgentPerformance[]> => {
      // AI agents
      const { data: aiConvs } = await supabase
        .from("ai_conversations")
        .select("current_agent_id, ai_resolved, resolution_seconds, csat_score, ai_agents!ai_conversations_current_agent_id_fkey(id, name)")
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .not("current_agent_id", "is", null);

      const aiMap = new Map<string, { name: string; total: number; resolved: number; resSum: number; resCount: number; csatSum: number; csatCount: number }>();
      for (const c of aiConvs || []) {
        const agent = c.ai_agents as Record<string, unknown> | null;
        if (!agent) continue;
        const id = agent.id as string;
        const name = agent.name as string;
        if (!aiMap.has(id)) aiMap.set(id, { name, total: 0, resolved: 0, resSum: 0, resCount: 0, csatSum: 0, csatCount: 0 });
        const e = aiMap.get(id)!;
        e.total++;
        if (c.ai_resolved) e.resolved++;
        if (c.resolution_seconds && c.resolution_seconds > 0) { e.resSum += c.resolution_seconds; e.resCount++; }
        if (c.csat_score) { e.csatSum += c.csat_score; e.csatCount++; }
      }

      // Human agents
      const { data: humanConvs } = await supabase
        .from("ai_conversations")
        .select("human_agent_id, ai_resolved, resolution_seconds, csat_score, status, human_agents(id, name)")
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .not("human_agent_id", "is", null);

      const humanMap = new Map<string, { name: string; total: number; resolved: number; resSum: number; resCount: number; csatSum: number; csatCount: number }>();
      for (const c of humanConvs || []) {
        const agent = c.human_agents as Record<string, unknown> | null;
        if (!agent) continue;
        const id = agent.id as string;
        const name = agent.name as string;
        if (!humanMap.has(id)) humanMap.set(id, { name, total: 0, resolved: 0, resSum: 0, resCount: 0, csatSum: 0, csatCount: 0 });
        const e = humanMap.get(id)!;
        e.total++;
        if (c.status === "finalizado" || c.status === "resolvido") e.resolved++;
        if (c.resolution_seconds && c.resolution_seconds > 0) { e.resSum += c.resolution_seconds; e.resCount++; }
        if (c.csat_score) { e.csatSum += c.csat_score; e.csatCount++; }
      }

      const result: AgentPerformance[] = [];
      aiMap.forEach((e, id) => result.push({
        id, name: e.name, type: "ia",
        conversations: e.total,
        successRate: e.total > 0 ? Math.round((e.resolved / e.total) * 100) : 0,
        avgCsat: e.csatCount > 0 ? Number((e.csatSum / e.csatCount).toFixed(1)) : 0,
        avgResolutionSeconds: e.resCount > 0 ? Math.round(e.resSum / e.resCount) : 0,
        costBrl: 0,
      }));
      humanMap.forEach((e, id) => result.push({
        id, name: e.name, type: "humano",
        conversations: e.total,
        successRate: e.total > 0 ? Math.round((e.resolved / e.total) * 100) : 0,
        avgCsat: e.csatCount > 0 ? Number((e.csatSum / e.csatCount).toFixed(1)) : 0,
        avgResolutionSeconds: e.resCount > 0 ? Math.round(e.resSum / e.resCount) : 0,
        costBrl: 0,
      }));

      return result.sort((a, b) => b.conversations - a.conversations);
    },
  });

  // Top 10 companies
  const topCompanies = useQuery({
    queryKey: ["exec-top-companies", fromISO, toISO],
    queryFn: async (): Promise<TopCompany[]> => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("helpdesk_client_id, helpdesk_clients(company_name, name)")
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .not("helpdesk_client_id", "is", null);

      const map = new Map<string, { name: string; count: number }>();
      for (const c of data || []) {
        const client = c.helpdesk_clients as Record<string, unknown> | null;
        if (!client) continue;
        const name = (client.company_name as string) || (client.name as string) || "Desconhecido";
        const id = c.helpdesk_client_id!;
        if (!map.has(id)) map.set(id, { name, count: 0 });
        map.get(id)!.count++;
      }

      return Array.from(map.values())
        .map(v => ({ name: v.name, total: v.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  return {
    kpis,
    dailyTrend,
    statusDist,
    priorityDist,
    categoryDist,
    hourlyHeatmap,
    agentPerformance,
    topCompanies,
  };
}
