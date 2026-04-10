import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodValue } from "@/components/layout/PeriodSelector";
import { format } from "date-fns";

export interface CompanyVolume {
  clientId: string;
  clientName: string;
  companyName: string;
  total: number;
  aiResolvedPct: number;
  avgResolutionSeconds: number;
  avgCsat: number;
  priorityBreakdown: { critica: number; alta: number; media: number; baixa: number };
}

export interface DailyTrend {
  date: string;
  [companyName: string]: string | number;
}

interface CompanyVolumeResult {
  companies: CompanyVolume[];
  dailyTrends: DailyTrend[];
  kpis: {
    totalCompanies: number;
    totalTickets: number;
    avgPerCompany: number;
  };
}

export function useCompanyVolumeReport(period: PeriodValue) {
  return useQuery({
    queryKey: ["company-volume-report", period.from.toISOString(), period.to.toISOString()],
    queryFn: async (): Promise<CompanyVolumeResult> => {
      // Fetch conversations
      const { data: conversations, error: convError } = await supabase
        .from("ai_conversations")
        .select("id, started_at, helpdesk_client_id, ai_resolved, resolution_seconds, csat_score, priority")
        .gte("started_at", period.from.toISOString())
        .lte("started_at", period.to.toISOString())
        .not("helpdesk_client_id", "is", null);

      if (convError) throw convError;

      // Fetch clients
      const { data: clients, error: clientError } = await supabase
        .from("helpdesk_clients")
        .select("id, name, company_name");

      if (clientError) throw clientError;

      const clientMap = new Map(
        (clients || []).map((c) => [c.id, { name: c.name || "", companyName: c.company_name || c.name || "" }])
      );

      // Aggregate by client
      const byClient = new Map<string, {
        total: number;
        aiResolved: number;
        resolutionSum: number;
        resolutionCount: number;
        csatSum: number;
        csatCount: number;
        priorities: { critica: number; alta: number; media: number; baixa: number };
        byDate: Map<string, number>;
      }>();

      for (const conv of conversations || []) {
        const cid = conv.helpdesk_client_id;
        if (!cid) continue;

        if (!byClient.has(cid)) {
          byClient.set(cid, {
            total: 0, aiResolved: 0,
            resolutionSum: 0, resolutionCount: 0,
            csatSum: 0, csatCount: 0,
            priorities: { critica: 0, alta: 0, media: 0, baixa: 0 },
            byDate: new Map(),
          });
        }

        const entry = byClient.get(cid)!;
        entry.total++;
        if (conv.ai_resolved) entry.aiResolved++;
        if (conv.resolution_seconds && conv.resolution_seconds > 0) {
          entry.resolutionSum += conv.resolution_seconds;
          entry.resolutionCount++;
        }
        if (conv.csat_score) {
          entry.csatSum += conv.csat_score;
          entry.csatCount++;
        }

        const p = conv.priority as keyof typeof entry.priorities;
        if (p && p in entry.priorities) entry.priorities[p]++;

        if (conv.started_at) {
          const dateKey = format(new Date(conv.started_at), "yyyy-MM-dd");
          entry.byDate.set(dateKey, (entry.byDate.get(dateKey) || 0) + 1);
        }
      }

      // Build companies array
      const companies: CompanyVolume[] = [];
      byClient.forEach((entry, cid) => {
        const client = clientMap.get(cid);
        companies.push({
          clientId: cid,
          clientName: client?.name || "Desconhecido",
          companyName: client?.companyName || "Desconhecido",
          total: entry.total,
          aiResolvedPct: entry.total > 0 ? Math.round((entry.aiResolved / entry.total) * 100) : 0,
          avgResolutionSeconds: entry.resolutionCount > 0 ? Math.round(entry.resolutionSum / entry.resolutionCount) : 0,
          avgCsat: entry.csatCount > 0 ? Number((entry.csatSum / entry.csatCount).toFixed(1)) : 0,
          priorityBreakdown: entry.priorities,
        });
      });

      companies.sort((a, b) => b.total - a.total);

      // Build daily trends for top 5
      const top5 = companies.slice(0, 5);
      const allDates = new Set<string>();
      top5.forEach((c) => {
        const entry = byClient.get(c.clientId)!;
        entry.byDate.forEach((_, date) => allDates.add(date));
      });

      const sortedDates = Array.from(allDates).sort();
      const dailyTrends: DailyTrend[] = sortedDates.map((date) => {
        const point: DailyTrend = { date };
        top5.forEach((c) => {
          const entry = byClient.get(c.clientId)!;
          point[c.companyName] = entry.byDate.get(date) || 0;
        });
        return point;
      });

      // KPIs
      const totalTickets = companies.reduce((s, c) => s + c.total, 0);
      const totalCompanies = companies.length;
      const avgPerCompany = totalCompanies > 0 ? Math.round(totalTickets / totalCompanies) : 0;

      return { companies, dailyTrends, kpis: { totalCompanies, totalTickets, avgPerCompany } };
    },
  });
}
