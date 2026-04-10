import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodValue } from "@/components/layout/PeriodSelector";

export interface TicketReportFilters {
  period: PeriodValue;
  search: string;
  status: string;
  priority: string;
  categoryId: string;
  moduleId: string;
  humanAgentId: string;
  aiAgentId: string;
  boardId: string;
  clientId: string;
}

interface TicketReportOptions {
  filters: TicketReportFilters;
  page: number;
  pageSize: number;
  sortField: string;
  sortDirection: "asc" | "desc";
}

export interface TicketRow {
  id: string;
  ticket_number: number;
  ticket_subject: string | null;
  customer_name: string | null;
  customer_phone: string;
  status: string | null;
  priority: string | null;
  handler_type: string | null;
  ai_resolved: boolean;
  csat_score: number | null;
  resolution_seconds: number | null;
  started_at: string | null;
  resolved_at: string | null;
  conversation_summary: string | null;
  tags: string[] | null;
  helpdesk_client_id: string | null;
  category_name: string | null;
  category_color: string | null;
  module_name: string | null;
  agent_name: string | null;
  human_agent_name: string | null;
  stage_name: string | null;
}

function applyFilters(query: any, filters: TicketReportFilters) {
  let q = query;

  // Period filter
  if (filters.period.from) {
    q = q.gte("started_at", filters.period.from.toISOString());
  }
  if (filters.period.to) {
    q = q.lte("started_at", filters.period.to.toISOString());
  }

  // Text search
  if (filters.search) {
    const s = `%${filters.search}%`;
    q = q.or(`ticket_subject.ilike.${s},customer_name.ilike.${s},customer_phone.ilike.${s}`);
  }

  // Dropdown filters
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.categoryId) q = q.eq("ticket_category_id", filters.categoryId);
  if (filters.moduleId) q = q.eq("ticket_module_id", filters.moduleId);
  if (filters.humanAgentId) q = q.eq("human_agent_id", filters.humanAgentId);
  if (filters.aiAgentId) q = q.eq("current_agent_id", filters.aiAgentId);
  if (filters.boardId) q = q.eq("kanban_board_id", filters.boardId);
  if (filters.clientId) q = q.eq("helpdesk_client_id", filters.clientId);

  return q;
}

export function useTicketReport(options: TicketReportOptions) {
  const { filters, page, pageSize, sortField, sortDirection } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ["ticket-report", filters, page, pageSize, sortField, sortDirection],
    queryFn: async () => {
      let query = supabase
        .from("ai_conversations")
        .select(
          `id, ticket_number, ticket_subject, customer_name, customer_phone,
           status, priority, handler_type, ai_resolved, csat_score,
           resolution_seconds, started_at, resolved_at, conversation_summary,
           tags, helpdesk_client_id,
           ticket_categories(name, color),
           ticket_modules(name),
           ai_agents!ai_conversations_current_agent_id_fkey(name),
           human_agents(name),
           kanban_stages!ai_conversations_kanban_stage_id_fkey(name)`,
          { count: "exact" }
        );

      query = applyFilters(query, filters);
      query = query.order(sortField, { ascending: sortDirection === "asc" });
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const rows: TicketRow[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        ticket_number: row.ticket_number as number,
        ticket_subject: row.ticket_subject as string | null,
        customer_name: row.customer_name as string | null,
        customer_phone: row.customer_phone as string,
        status: row.status as string | null,
        priority: row.priority as string | null,
        handler_type: row.handler_type as string | null,
        ai_resolved: row.ai_resolved as boolean,
        csat_score: row.csat_score as number | null,
        resolution_seconds: row.resolution_seconds as number | null,
        started_at: row.started_at as string | null,
        resolved_at: row.resolved_at as string | null,
        conversation_summary: row.conversation_summary as string | null,
        tags: row.tags as string[] | null,
        helpdesk_client_id: row.helpdesk_client_id as string | null,
        category_name: (row.ticket_categories as Record<string, unknown> | null)?.name as string | null,
        category_color: (row.ticket_categories as Record<string, unknown> | null)?.color as string | null,
        module_name: (row.ticket_modules as Record<string, unknown> | null)?.name as string | null,
        agent_name: (row.ai_agents as Record<string, unknown> | null)?.name as string | null,
        human_agent_name: (row.human_agents as Record<string, unknown> | null)?.name as string | null,
        stage_name: (row.kanban_stages as Record<string, unknown> | null)?.name as string | null,
      }));

      return { rows, total: count || 0 };
    },
  });
}

export function useTicketReportKPIs(filters: TicketReportFilters) {
  return useQuery({
    queryKey: ["ticket-report-kpis", filters],
    queryFn: async () => {
      let query = supabase
        .from("ai_conversations")
        .select("status, resolution_seconds, csat_score, ai_resolved");

      query = applyFilters(query, filters);

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      const total = items.length;
      const open = items.filter((i) => i.status === "aberto" || i.status === "aguardando" || i.status === "em_atendimento").length;
      const resolved = items.filter((i) => i.status === "finalizado" || i.status === "resolvido").length;
      const aiResolved = items.filter((i) => i.ai_resolved).length;

      const csatItems = items.filter((i) => i.csat_score != null);
      const avgCsat = csatItems.length ? csatItems.reduce((s, i) => s + (i.csat_score || 0), 0) / csatItems.length : 0;

      const resItems = items.filter((i) => i.resolution_seconds != null && i.resolution_seconds > 0);
      const avgResolution = resItems.length ? resItems.reduce((s, i) => s + (i.resolution_seconds || 0), 0) / resItems.length : 0;

      return { total, open, resolved, aiResolved, avgCsat, avgResolution };
    },
  });
}

export function useTicketLookups() {
  const categories = useQuery({
    queryKey: ["lookup-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_categories").select("id, name, color").eq("active", true).order("sort_order");
      return data || [];
    },
    staleTime: 60000,
  });

  const modules = useQuery({
    queryKey: ["lookup-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_modules").select("id, name").eq("active", true).order("sort_order");
      return data || [];
    },
    staleTime: 60000,
  });

  const humanAgents = useQuery({
    queryKey: ["lookup-human-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("human_agents").select("id, name").neq("is_active", false).order("name");
      return data || [];
    },
    staleTime: 60000,
  });

  const aiAgents = useQuery({
    queryKey: ["lookup-ai-agents"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    staleTime: 60000,
  });

  const boards = useQuery({
    queryKey: ["lookup-boards"],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_boards").select("id, name").eq("active", true).order("name");
      return data || [];
    },
    staleTime: 60000,
  });

  const clients = useQuery({
    queryKey: ["lookup-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("helpdesk_clients").select("id, name, company_name").order("name").limit(500);
      return data || [];
    },
    staleTime: 60000,
  });

  return { categories, modules, humanAgents, aiAgents, boards, clients };
}

export async function fetchAllTicketsForExport(filters: TicketReportFilters) {
  let query = supabase
    .from("ai_conversations")
    .select(
      `ticket_number, ticket_subject, customer_name, customer_phone,
       status, priority, handler_type, ai_resolved, csat_score,
       resolution_seconds, started_at, resolved_at,
       ticket_categories(name),
       human_agents(name),
       ai_agents!ai_conversations_current_agent_id_fkey(name)`
    );

  query = applyFilters(query, filters) as typeof query;
  query = query.order("started_at", { ascending: false }).limit(5000);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    ticket_number: row.ticket_number,
    assunto: row.ticket_subject || "",
    cliente: row.customer_name || row.customer_phone,
    status: row.status || "",
    prioridade: row.priority || "",
    tipo: row.handler_type || "",
    ia_resolvido: (row.ai_resolved as boolean) ? "Sim" : "Não",
    csat: row.csat_score || "",
    tempo_resolucao_min: row.resolution_seconds ? Math.round((row.resolution_seconds as number) / 60) : "",
    inicio: row.started_at ? new Date(row.started_at as string).toLocaleString("pt-BR") : "",
    resolvido_em: row.resolved_at ? new Date(row.resolved_at as string).toLocaleString("pt-BR") : "",
    categoria: (row.ticket_categories as Record<string, unknown> | null)?.name || "",
    agente_humano: (row.human_agents as Record<string, unknown> | null)?.name || "",
    agente_ia: (row.ai_agents as Record<string, unknown> | null)?.name || "",
  }));
}
