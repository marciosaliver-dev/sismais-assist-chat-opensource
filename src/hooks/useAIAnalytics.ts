import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Hook: Consumo por período — uses ai_messages table
export const useAIConsumption = (startDate: string, endDate: string, agentId?: string) => {
  return useQuery({
    queryKey: ['ai-consumption', startDate, endDate, agentId],
    queryFn: async () => {
      let query = supabase
        .from('ai_messages')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logs = (data || []) as any[];
      const total_tokens = logs.reduce((sum: number, log: any) => sum + (log.total_tokens || 0), 0);
      const total_cost = logs.reduce((sum: number, log: any) => sum + (log.cost_usd || 0), 0);
      const total_calls = logs.length;

      return {
        total_tokens,
        total_cost_usd: total_cost,
        total_calls,
        avg_response_time_ms: 0,
        logs,
      };
    },
  });
};

// Hook: Consumo por agente — aggregates from ai_messages
export const useAgentConsumption = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-agent-consumption', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('agent_id, total_tokens, cost_usd, ai_agents(name)')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null)
        .not('agent_id', 'is', null);

      if (error) throw error;

      const rows = (data || []) as any[];
      const byAgent: Record<string, { agent_id: string; agent_name: string; total_calls: number; total_cost_usd: number; total_tokens: number }> = {};
      for (const row of rows) {
        const key = row.agent_id;
        if (!byAgent[key]) {
          byAgent[key] = { agent_id: key, agent_name: row.ai_agents?.name || key, total_calls: 0, total_cost_usd: 0, total_tokens: 0 };
        }
        byAgent[key].total_calls += 1;
        byAgent[key].total_cost_usd += row.cost_usd || 0;
        byAgent[key].total_tokens += row.total_tokens || 0;
      }
      return Object.values(byAgent).sort((a, b) => b.total_cost_usd - a.total_cost_usd);
    },
  });
};

// Hook: Consumo por modelo — aggregates from ai_messages
export const useModelConsumption = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-model-consumption', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('model_used, total_tokens, cost_usd, prompt_tokens, completion_tokens')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null)
        .not('model_used', 'is', null);

      if (error) throw error;

      const rows = (data || []) as any[];
      const byModel: Record<string, { model_name: string; provider: string; total_calls: number; total_cost_usd: number; total_tokens: number }> = {};
      for (const row of rows) {
        const key = row.model_used;
        if (!byModel[key]) {
          const parts = key.split('/');
          byModel[key] = { model_name: key, provider: parts.length > 1 ? parts[0] : '', total_calls: 0, total_cost_usd: 0, total_tokens: 0 };
        }
        byModel[key].total_calls += 1;
        byModel[key].total_cost_usd += row.cost_usd || 0;
        byModel[key].total_tokens += row.total_tokens || 0;
      }
      return Object.values(byModel).sort((a, b) => b.total_cost_usd - a.total_cost_usd);
    },
  });
};

// Hook: Todas as mensagens de IA (envios e respostas)
export const useAIMessagesLog = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-messages-log', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('id, role, content, model_used, total_tokens, prompt_tokens, completion_tokens, cost_usd, created_at, sentiment, intent, agent_id, conversation_id, ai_agents(name)')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('total_tokens', 'is', null)
        .gt('total_tokens', 0)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as any[];
    },
  });
};

// Hook: Consumo por feature (usa ai_usage_log)
export const useFeatureConsumption = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['ai-feature-consumption', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ai_usage_log' as any) as any)
        .select('feature, model, input_tokens, output_tokens, cost_usd')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const rows = (data || []) as any[];
      const byFeature: Record<string, { feature: string; total_calls: number; total_cost_usd: number; total_input_tokens: number; total_output_tokens: number }> = {};
      for (const row of rows) {
        const key = row.feature;
        if (!byFeature[key]) {
          byFeature[key] = { feature: key, total_calls: 0, total_cost_usd: 0, total_input_tokens: 0, total_output_tokens: 0 };
        }
        byFeature[key].total_calls += 1;
        byFeature[key].total_cost_usd += row.cost_usd || 0;
        byFeature[key].total_input_tokens += row.input_tokens || 0;
        byFeature[key].total_output_tokens += row.output_tokens || 0;
      }
      return Object.values(byFeature).sort((a, b) => b.total_cost_usd - a.total_cost_usd);
    },
  });
};

// Hook: Análise da conversa
export const useConversationAnalysis = (conversationId: string) => {
  return useQuery({
    queryKey: ['conversation-analysis', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*, ai_messages(*)')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) throw error;

      const conv = data as any;
      return {
        satisfactionLevel: conv.satisfaction_level || 'neutral',
        satisfactionScore: 60,
        resolutionProbability: 72,
        sentiment: 'neutral' as const,
        urgency: conv.priority || 'medium',
        category: conv.category,
        status: conv.kanban_status,
      };
    },
    enabled: !!conversationId,
  });
};

// Hook: Rastrear uso de IA
export const useTrackAIUsage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      messageId?: string;
      agentId: string;
      provider: string;
      modelName: string;
      operationType: string;
      inputTokens: number;
      outputTokens: number;
      inputCostUsd: number;
      outputCostUsd: number;
      responseTimeMs?: number;
    }) => {
      const { data, error } = await supabase.rpc('track_ai_usage' as any, {
        p_conversation_id: params.conversationId,
        p_message_id: params.messageId,
        p_agent_id: params.agentId,
        p_provider: params.provider,
        p_model_name: params.modelName,
        p_operation_type: params.operationType,
        p_input_tokens: params.inputTokens,
        p_output_tokens: params.outputTokens,
        p_input_cost_usd: params.inputCostUsd,
        p_output_cost_usd: params.outputCostUsd,
        p_response_time_ms: params.responseTimeMs,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-consumption'] });
    },
  });
};

// Hook: Board Kanban
export const useKanbanBoard = (filters?: {
  agentId?: string;
  category?: string;
  priority?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['kanban-board', filters],
    queryFn: async () => {
      let query: any = supabase
        .from('ai_conversations')
        .select('*, customer:customers(*), agent:ai_agents(*)')
        .order('started_at', { ascending: false });

      if (filters?.agentId) {
        query = query.eq('agent_id', filters.agentId);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const conversations = (data || []) as any[];
      return {
        new: conversations.filter(c => (c.kanban_status || c.status) === 'new'),
        in_progress: conversations.filter(c => (c.kanban_status || c.status) === 'in_progress' || c.status === 'active'),
        waiting_customer: conversations.filter(c => (c.kanban_status || c.status) === 'waiting_customer' || c.status === 'waiting'),
        waiting_internal: conversations.filter(c => (c.kanban_status || c.status) === 'waiting_internal'),
        resolved: conversations.filter(c => (c.kanban_status || c.status) === 'resolved' || c.status === 'closed'),
        escalated: conversations.filter(c => (c.kanban_status || c.status) === 'escalated'),
      };
    },
  });
};

// Hook: Mover card no Kanban
export const useMoveKanbanCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      newStatus: string;
      newPosition: number;
    }) => {
      const updatePayload: Record<string, any> = {
        kanban_status: params.newStatus,
        kanban_position: params.newPosition,
      };
      const { data, error } = await (supabase
        .from('ai_conversations') as any)
        .update(updatePayload)
        .eq('id', params.conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-board'] });
    },
  });
};

// Utilitário: Calcular custo por modelo
export const calculateModelCost = (
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number } => {
  // Pricing aligned with ai_model_catalog (fallback for offline calculation)
  const pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.0-flash-lite': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    'gemini-2.0-flash': { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'gpt-5-mini': { input: 0.25 / 1_000_000, output: 2.00 / 1_000_000 },
    'gemini-2.5-flash': { input: 0.25 / 1_000_000, output: 1.00 / 1_000_000 },
    'gemini-3-flash': { input: 0.50 / 1_000_000, output: 3.00 / 1_000_000 },
    'claude-3-5-haiku': { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
    'gpt-5': { input: 1.25 / 1_000_000, output: 10.00 / 1_000_000 },
    'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
    'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'claude-3-5-sonnet': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
    'text-embedding-3-small': { input: 0.02 / 1_000_000, output: 0 },
  };

  // Try exact match, then partial match on model name
  const modelKey = Object.keys(pricing).find(k => model.includes(k));
  const rates = pricing[modelKey || 'gemini-2.0-flash'];

  return {
    inputCost: inputTokens * rates.input,
    outputCost: outputTokens * rates.output,
  };
};

// Utilitário: Formatar moeda BRL
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Utilitário: Formatar número
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value);
};
