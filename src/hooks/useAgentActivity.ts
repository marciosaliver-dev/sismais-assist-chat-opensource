import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  start: Date;
  end: Date;
}

export function useAgentActivity(agentId: string, dateRange: DateRange) {
  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  const agentQuery = useQuery({
    queryKey: ["agent-activity-agent", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("id", agentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const conversationsQuery = useQuery({
    queryKey: ["agent-activity-conversations", agentId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select(
          "id, ticket_subject, status, started_at, resolved_at, ai_resolved, resolution_time_seconds"
        )
        .eq("current_agent_id", agentId)
        .gte("started_at", startISO)
        .lte("started_at", endISO)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
  });

  const messagesQuery = useQuery({
    queryKey: ["agent-activity-messages", agentId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select(
          "id, role, confidence, cost_usd, tools_used, created_at, intent, sentiment, total_tokens"
        )
        .eq("agent_id", agentId)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
  });

  const auditQuery = useQuery({
    queryKey: ["agent-activity-audit", agentId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_audit_log")
        .select(
          "id, action_taken, guardrails_triggered, response_time_ms, confidence_score, created_at"
        )
        .eq("agent_id", agentId)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const audit = auditQuery.data ?? [];

  const totalConversations = conversations.length;
  const aiResolvedCount = conversations.filter((c) => c.ai_resolved).length;
  const aiResolvedRate =
    totalConversations > 0 ? aiResolvedCount / totalConversations : 0;

  const confidences = messages
    .map((m) => m.confidence)
    .filter((c): c is number => c !== null);
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  const totalCost = messages.reduce((sum, m) => sum + (m.cost_usd ?? 0), 0);

  const responseTimes = audit
    .map((a) => a.response_time_ms)
    .filter((t): t is number => t !== null);
  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  return {
    agent: agentQuery.data ?? null,
    kpis: {
      totalConversations,
      aiResolvedRate,
      avgConfidence,
      totalCost,
      avgResponseTime,
    },
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.ticket_subject,
      status: c.status,
      started_at: c.started_at,
      resolved_at: c.resolved_at,
      ai_resolved: c.ai_resolved,
      resolution_time_seconds: c.resolution_time_seconds,
    })),
    recentMessages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      confidence: m.confidence,
      cost_usd: m.cost_usd,
      tools_used: m.tools_used,
      created_at: m.created_at,
      intent: m.intent,
      sentiment: m.sentiment,
    })),
    auditLog: audit.map((a) => ({
      id: a.id,
      action_taken: a.action_taken,
      guardrails_triggered: a.guardrails_triggered,
      response_time_ms: a.response_time_ms,
      confidence_score: a.confidence_score,
      created_at: a.created_at,
    })),
    isLoading:
      agentQuery.isLoading ||
      conversationsQuery.isLoading ||
      messagesQuery.isLoading ||
      auditQuery.isLoading,
  };
}
